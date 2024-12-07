import {
    initializeBlock,
    useBase,
    useGlobalConfig,
    Box,
    Button,
    FormField,
    Input,
    Select,
    Text,
    Icon,
    TablePickerSynced,
    useViewport,
    Heading,
} from '@airtable/blocks/ui';
import React, { useState, useEffect } from 'react';

function BancoMercantilApp() {
    const base = useBase();
    const globalConfig = useGlobalConfig();
    const viewport = useViewport();
    const [file, setFile] = useState(null);
    const [status, setStatus] = useState({ message: '', type: 'info' });
    const [previewData, setPreviewData] = useState([]);
    const [isProcessing, setIsProcessing] = useState(false);

    // Inicializar configuración global
    useEffect(() => {
        // Asegurarse de que loteNumber esté inicializado
        if (globalConfig.get('loteNumber') === undefined) {
            globalConfig.setAsync('loteNumber', '');
        }
        // Asegurarse de que selectedTableId esté inicializado
        if (globalConfig.get('selectedTableId') === undefined) {
            globalConfig.setAsync('selectedTableId', '');
        }
    }, []);

    // Función para limpiar y convertir valores numéricos
    const cleanAndConvertToFloat = (value) => {
        if (!value) return 0;
        
        // Eliminar espacios y comillas
        let cleaned = value.replace(/["\s]/g, '');
        
        // Manejar formato venezolano: 1.234,56 -> 1234.56
        if (cleaned.includes(',')) {
            // Primero eliminar los puntos (separadores de miles)
            cleaned = cleaned.replace(/\./g, '');
            // Luego reemplazar la coma por punto
            cleaned = cleaned.replace(',', '.');
        }
        
        const result = parseFloat(cleaned);
        return isNaN(result) ? 0 : result;
    };

    // Función para convertir fecha del formato del banco al formato de Airtable
    const convertDate = (dateStr) => {
        // El formato del banco es DDMMYYYY
        if (!dateStr || dateStr.length !== 8) return null;
        
        const day = dateStr.substring(0, 2);
        const month = dateStr.substring(2, 4);
        const year = dateStr.substring(4, 8);
        
        return `${year}-${month}-${day}`;
    };

    // Función para parsear una línea CSV con comillas dobles
    const parseCSVLine = (line) => {
        // Eliminar espacios en blanco al inicio y final
        line = line.trim();
        if (!line) return [];

        const result = [];
        let value = '';
        let insideQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            
            if (char === '"') {
                insideQuotes = !insideQuotes;
                // No agregamos las comillas al valor
            } else if (char === ',' && !insideQuotes) {
                // Final del campo - agregar el valor sin las comillas
                result.push(value.trim());
                value = '';
            } else {
                value += char;
            }
        }
        
        // Agregar el último valor
        if (value) {
            result.push(value.trim());
        }

        return result;
    };

    // Función para formatear el número de lote con el año actual
    const getFormattedLote = (loteInput) => {
        const currentYear = new Date().getFullYear();
        return `${loteInput}-${currentYear}`;
    };

    // Función para verificar si un lote ya existe en el año actual
    const checkLoteExists = async (loteInput) => {
        const currentYear = new Date().getFullYear();
        const loteToCheck = `${loteInput}-${currentYear}`;
        
        // Obtener todos los registros existentes
        const table = base.getTableByIdIfExists(globalConfig.get('selectedTableId'));
        if (!table) return false;
        
        const query = await table.selectRecordsAsync();
        const existingLotes = new Set(
            query.records
                .map(record => record.getCellValue('LOTE'))
                .filter(lote => lote) // Filtrar nulos
        );
        
        return existingLotes.has(loteToCheck);
    };

    const processCSV = async (csvText) => {
        console.log('Contenido del archivo:', csvText);
        
        // Eliminar líneas vacías y espacios en blanco
        const lines = csvText.split('\n').filter(line => line.trim());
        console.log('Líneas después de filtrar:', lines);

        const processedData = [];
        let id_registro = 1;
        let registrosProcesados = 0;
        let registrosDuplicados = 0;

        // Obtener y validar el número de lote
        const loteInput = globalConfig.get('loteNumber');
        if (!loteInput) {
            setStatus({
                message: 'Error: Debe ingresar un número de lote antes de procesar el archivo',
                type: 'error'
            });
            return;
        }

        // Verificar si el lote ya existe
        const loteExists = await checkLoteExists(loteInput);
        if (loteExists) {
            setStatus({
                message: `Error: El lote ${loteInput} ya existe para el año en curso. Use un código diferente.`,
                type: 'error'
            });
            return;
        }

        const loteNumber = getFormattedLote(loteInput);
        console.log('Número de lote:', loteNumber);

        // Obtener la tabla y los registros existentes
        const tableId = globalConfig.get('selectedTableId');
        if (!tableId) {
            throw new Error('Por favor seleccione una tabla primero');
        }
        const table = base.getTableByIdIfExists(tableId);
        const query = await table.selectRecordsAsync();
        const existingRecords = query.records;

        // Usar FileReader para leer el contenido del archivo
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) {
                console.log(`Línea ${i + 1} vacía, saltando...`);
                continue;
            }
            
            console.log(`\nProcesando línea ${i + 1}:`, line);
            registrosProcesados++;

            // Dividir la línea por comas, pero preservar las comas dentro de comillas
            const values = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g);
            if (!values) {
                console.log(`Error al parsear línea ${i + 1}`);
                continue;
            }

            // Limpiar las comillas de cada valor
            const cleanValues = values.map(val => val.replace(/^"|"$/g, ''));
            console.log('Valores limpios:', cleanValues);

            if (cleanValues.length < 10) {
                console.log(`Línea ${i + 1} ignorada: insuficientes campos (${cleanValues.length})`);
                continue;
            }

            const fecha = convertDate(cleanValues[3]);
            if (!fecha) {
                console.log(`Línea ${i + 1} ignorada: fecha inválida`, cleanValues[3]);
                continue;
            }
            
            const referencia = cleanValues[4];
            const tipo = cleanValues[5];
            const descripcion = cleanValues[6];
            const monto = cleanAndConvertToFloat(cleanValues[7]);
            const saldo = cleanAndConvertToFloat(cleanValues[8]);

            console.log('Registro procesado:', {
                fecha,
                referencia,
                tipo,
                descripcion,
                monto,
                saldo
            });

            // Verificar si el registro ya existe
            const isDuplicate = existingRecords.some(record => {
                const recordFecha = record.getCellValue('FECHA');
                const recordRef = record.getCellValue('REFERENCIA');
                const recordDesc = record.getCellValue('DESCRIPCION');
                
                const isDup = recordFecha === fecha &&
                            recordRef === referencia &&
                            recordDesc === descripcion;
                
                if (isDup) {
                    console.log('Encontrado duplicado:', {
                        recordFecha,
                        recordRef,
                        recordDesc
                    });
                }
                
                return isDup;
            });

            if (!isDuplicate) {
                const ingreso = tipo === "NC" ? monto : 0;
                const egreso = tipo === "ND" ? monto : 0;

                const row = {
                    fields: {
                        'FECHA': fecha,
                        'REFERENCIA': referencia,
                        'DESCRIPCION': descripcion,
                        'INGRESO': ingreso,
                        'EGRESO': egreso,
                        'SALDO': saldo,
                        'ID_REGISTRO': id_registro,
                        'LOTE': loteNumber
                    }
                };
                processedData.push(row);
                id_registro++;
                console.log('Registro nuevo agregado exitosamente');
            } else {
                registrosDuplicados++;
                console.log('Registro duplicado encontrado - no se agregará');
            }
        }

        console.log('Datos procesados:', processedData);

        if (processedData.length === 0) {
            const report = `
=== REPORTE DE PROCESAMIENTO ===
Registros procesados: ${registrosProcesados}
Registros duplicados: ${registrosDuplicados}
Registros nuevos: 0
==============================
            `;
            console.log(report);
            setStatus({
                message: 'No se encontraron registros válidos para procesar en el archivo',
                type: 'error'
            });
            return;
        }

        const report = `
=== REPORTE DE PROCESAMIENTO ===
Registros procesados: ${registrosProcesados}
Registros duplicados: ${registrosDuplicados}
Registros nuevos: ${processedData.length}
==============================
        `;
        console.log(report);

        setPreviewData(processedData.slice(0, 5));
        setStatus({ 
            message: report.replace(/=/g, '-'),
            type: 'success'
        });

        try {
            // Crear registros en lotes de 50 para evitar límites de API
            const batchSize = 50;
            for (let i = 0; i < processedData.length; i += batchSize) {
                const batch = processedData.slice(i, i + batchSize);
                await table.createRecordsAsync(batch);
            }
            
            const finalReport = `
${report}
Proceso completado exitosamente.
Los registros han sido creados en Airtable.
            `;
            
            setStatus({
                message: finalReport.replace(/=/g, '-'),
                type: 'success'
            });
        } catch (error) {
            console.error('Error al crear registros:', error);
            setStatus({
                message: `Error al crear registros: ${error.message}`,
                type: 'error'
            });
        }
    };

    const handleFileChange = async (e) => {
        const file = e.target.files[0];
        setFile(file);
        
        if (file) {
            try {
                const text = await file.text();
                console.log('Contenido del archivo:', text);
                await processCSV(text);
            } catch (error) {
                console.error('Error al leer el archivo:', error);
                setStatus({
                    message: `Error al leer el archivo: ${error.message}`,
                    type: 'error'
                });
            }
        }
    };

    const handleUpload = async () => {
        if (!file) {
            setStatus({
                message: 'Por favor seleccione un archivo primero.',
                type: 'error'
            });
            return;
        }

        setIsProcessing(true);
        setStatus({ message: 'Procesando archivo...', type: 'info' });

        try {
            const text = await file.text();
            processCSV(text);
        } catch (error) {
            console.error('Error al procesar el archivo:', error);
            setStatus({
                message: `Error al procesar el archivo: ${error.message}`,
                type: 'error'
            });
        } finally {
            setIsProcessing(false);
        }
    };

    // Estilo para el contenedor principal
    const containerStyle = {
        padding: '16px',
        maxWidth: '800px',
        margin: '0 auto'
    };

    // Estilo para el área de selección de archivo
    const fileInputStyle = {
        marginBottom: '16px'
    };

    // Estilo para los botones
    const buttonStyle = {
        marginRight: '8px'
    };

    // Estilo para los mensajes de estado
    const statusStyle = {
        padding: '8px',
        marginTop: '16px',
        marginBottom: '16px',
        borderRadius: '4px',
        backgroundColor: status.type === 'error' ? '#ffebee' : 
                       status.type === 'success' ? '#e8f5e9' : 
                       '#e3f2fd',
        color: status.type === 'error' ? '#c62828' : 
               status.type === 'success' ? '#2e7d32' : 
               '#1565c0'
    };

    // Estilo para la tabla de vista previa
    const previewStyle = {
        marginTop: '16px',
        overflowX: 'auto'
    };

    return (
        <Box padding={3}>
            <Heading size="xlarge" marginBottom={3}>
                Carga de Movimientos Bancarios - Banco Mercantil
            </Heading>

            <Box marginBottom={3}>
                <FormField label="Seleccionar Tabla">
                    <TablePickerSynced globalConfigKey="selectedTableId" />
                </FormField>
            </Box>

            <Box marginBottom={3}>
                <FormField label="Número de Lote">
                    <Input
                        value={globalConfig.get('loteNumber') || ''}
                        onChange={e => {
                            try {
                                globalConfig.setAsync('loteNumber', e.target.value);
                            } catch (error) {
                                console.error('Error al actualizar loteNumber:', error);
                            }
                        }}
                        placeholder="Ingrese el número de lote"
                    />
                </FormField>
            </Box>

            <Box marginBottom={3}>
                <FormField label="Seleccionar Archivo">
                    <input
                        type="file"
                        accept=".txt,.csv"
                        onChange={handleFileChange}
                        style={{ display: 'block', marginBottom: '8px' }}
                    />
                </FormField>
            </Box>

            <Box marginBottom={3}>
                <Button
                    variant="primary"
                    onClick={handleUpload}
                    disabled={!file || isProcessing}
                    icon={isProcessing ? "loading" : "upload"}
                >
                    {isProcessing ? 'Procesando...' : 'Procesar Archivo'}
                </Button>
            </Box>

            {status.message && (
                <Box
                    marginY={3}
                    padding={2}
                    backgroundColor={status.type === 'error' ? '#ffebee' : 
                                   status.type === 'success' ? '#e8f5e9' : 
                                   '#e3f2fd'}
                    borderRadius="large"
                >
                    <Text textColor={status.type === 'error' ? '#c62828' : 
                                   status.type === 'success' ? '#2e7d32' : 
                                   '#1565c0'}>
                        {status.message}
                    </Text>
                </Box>
            )}

            {previewData.length > 0 && (
                <Box marginTop={3}>
                    <Heading size="small" marginBottom={2}>Vista Previa</Heading>
                    <Box overflow="auto">
                        <table className="preview-table">
                            <thead>
                                <tr>
                                    {Object.keys(previewData[0].fields).map(header => (
                                        <th key={header}>{header}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {previewData.map((row, index) => (
                                    <tr key={index}>
                                        {Object.values(row.fields).map((value, i) => (
                                            <td key={i}>{value}</td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </Box>
                </Box>
            )}
        </Box>
    );
}

// Inicializar la extensión
initializeBlock(() => <BancoMercantilApp />);
