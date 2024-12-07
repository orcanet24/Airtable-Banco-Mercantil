# Importador Banco Mercantil - Extensión Airtable

Esta extensión permite importar archivos de transacciones bancarias del Banco Mercantil directamente a Airtable.

## Características

- Importa archivos .txt del Banco Mercantil
- Detecta y evita duplicados automáticamente
- Asigna IDs de registro secuenciales
- Maneja correctamente ingresos y egresos
- Validación de lotes únicos por año
- Reporte detallado de registros procesados

## Instalación Local

1. Clona este repositorio:
```bash
git clone [URL_DEL_REPOSITORIO]
```

2. Instala las dependencias:
```bash
npm install
```

3. Inicia la extensión en modo desarrollo:
```bash
block run
```

## Uso

1. Selecciona la tabla donde deseas importar los datos
2. Ingresa un número de lote (debe ser único para el año en curso)
3. Selecciona el archivo .txt del banco
4. La extensión procesará el archivo y mostrará un reporte detallado

## Estructura de la Tabla

La tabla debe tener los siguientes campos:
- FECHA (Texto)
- REFERENCIA (Texto)
- DESCRIPCION (Texto)
- INGRESO (Número)
- EGRESO (Número)
- SALDO (Número)
- ID_REGISTRO (Número)
- LOTE (Texto)

## Formato del Archivo

El archivo debe ser un .txt con el siguiente formato:
```
"0105","VEB","001136129340","02122024","82550891918","NC","PAGO MOVIL COMERCIAL INTERBANCARIO","632,00","7.044,44","0825"
```

## Licencia

MIT
