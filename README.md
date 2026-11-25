# SistemaInventario

Sistema web básico de **gestión de inventario**: permite registrar objetos con su imagen, ver cuántas unidades hay, ingresar o despachar mercancía y consultar el historial de movimientos. Está pensado para que lo usen dos personas, sin registro de usuarios.

## Funciones

- **Objetos:** nombre, cantidad, descripción, imagen y cantidad mínima. Se pueden crear, ver, editar y eliminar.
- **Lista del inventario:** cada objeto se ve con su imagen pequeña, su nombre y su cantidad.
- **Estados de stock:** *normal* (verde), *próximo a agotar* (amarillo, cuando la cantidad es igual o menor a la mínima) y *agotado* (rojo).
- **Ingresar o despachar:** cada movimiento guarda quién entregó y quién recibió (texto libre). Los ingresos suman y los despachos restan.
- **Regla de stock:** no se puede despachar más de lo que hay. Si se intenta, el sistema responde *"No hay suficientes productos"*.
- **Historial:** una sola tabla de movimientos (entrada o salida). El historial se conserva aunque se elimine el objeto.
- **Búsqueda en tiempo real:** en la lista del inventario, y en el selector de objeto al ingresar y al despachar (se puede escribir o elegir de la lista desplegable).

## Tecnologías

| Parte | Tecnología |
| --- | --- |
| Frontend | React 19, Vite, React Router |
| Backend | Node.js, Express 5, multer (subida de imágenes), mysql2, dotenv, cors |
| Base de datos | MySQL 8 |

## Estructura del proyecto

```
SistemaInventario/
├── backend/
│   ├── database/        schema.sql, limpiar_historial.sql, reiniciar_todo.sql
│   ├── src/
│   │   ├── config/      conexión a MySQL
│   │   ├── controllers/ lógica de productos y movimientos
│   │   ├── middlewares/ subida de imágenes (multer)
│   │   ├── routes/      direcciones de la API
│   │   ├── utils/       validaciones, transacciones, manejo de errores
│   │   ├── app.js       configuración de Express
│   │   └── server.js    arranque del servidor
│   ├── uploads/         imágenes subidas (no se sube a Git)
│   └── .env.example     plantilla de variables de entorno
└── frontend/
    └── src/
        ├── components/  Header, Footer, formularios, selector, historial
        ├── pages/       Productos (inventario) y Movimientos (ingresar/despachar)
        ├── services/    api.js (toda la comunicación con el backend)
        ├── styles/      variables.css y global.css
        └── utils/       funciones de estado de stock y búsqueda
```

## Requisitos

- [Node.js](https://nodejs.org/) (versión LTS reciente)
- [MySQL 8](https://dev.mysql.com/downloads/) (se recomienda instalar también MySQL Workbench)

## Instalación y uso en local

### 1. Base de datos

1. Abre MySQL Workbench y conéctate a tu servidor.
2. Abre `backend/database/schema.sql` y ejecútalo completo. Crea la base `inventario_db` con las tablas `productos` y `movimientos`.

### 2. Backend

```bash
cd backend
npm install
```

Copia `.env.example` con el nombre `.env` y escribe tus datos:

```env
PORT=3000
FRONTEND_URL=http://localhost:5173
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=tu_clave_de_mysql
DB_NAME=inventario_db
```

Inicia el servidor:

```bash
npm run dev      # desarrollo (se reinicia solo al guardar)
npm start        # normal
```

Para comprobar que funciona, abre <http://localhost:3000/api/salud>.

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

Abre <http://localhost:5173>. Si el backend está en otra dirección, crea `frontend/.env` con:

```env
VITE_API_URL=http://direccion-del-backend
```

## API

| Método | Ruta | Qué hace |
| --- | --- | --- |
| GET | `/api/salud` | Comprueba el servidor y la base de datos |
| GET | `/api/productos` | Lista los objetos |
| POST | `/api/productos` | Crea un objeto (con imagen opcional) y su movimiento de entrada inicial |
| PUT | `/api/productos/:id` | Edita nombre, descripción, cantidad mínima e imagen |
| DELETE | `/api/productos/:id` | Elimina el objeto (el historial se conserva) |
| GET | `/api/movimientos` | Lista el historial, del más reciente al más antiguo |
| POST | `/api/movimientos` | Registra una entrada o una salida |

Respuestas de error principales: `400` datos inválidos, `404` no existe, `409` conflicto (nombre repetido o stock insuficiente), `503` base de datos no disponible.

## Decisiones de diseño

- **Cantidad actual:** vive como campo del producto y se actualiza con cada movimiento. La cantidad no se edita a mano: solo cambia con entradas y salidas, así el historial siempre cuadra.
- **Movimientos con transacción:** cada ingreso o despacho bloquea la fila del producto mientras se guarda, de modo que dos despachos simultáneos no puedan dejar el stock en negativo.
- **Historial permanente:** el movimiento guarda también el nombre del producto, por eso sigue siendo legible aunque el objeto se elimine.
- **Imágenes:** el archivo se guarda en `backend/uploads` y en la base de datos solo se guarda su ruta. Se aceptan JPG, PNG, WEBP y GIF de hasta 5 MB.
- **Estado de stock calculado:** "próximo a agotar" y "agotado" no se guardan; se calculan a partir de la cantidad y la cantidad mínima. Una mínima de 0 significa "sin aviso".

## Diseño visual

- Persimmon `#E45B11`: color principal (bordes, botones, encabezado).
- Blood Orange `#B50001`: alertas, eliminar y agotado.
- Verde `#2E7D32`: stock normal y mensajes de éxito.
- Ámbar `#F6B50F`: próximo a agotar.
- Fondo blanco, con el contenido en una tarjeta de bordes redondeados y sombra.

## Mantenimiento de los datos

En `backend/database/` hay dos scripts para ejecutar desde MySQL Workbench:

- `limpiar_historial.sql`: borra **solo los movimientos**. Los objetos y sus cantidades se quedan (el historial nuevo ya no explicará el stock existente).
- `reiniciar_todo.sql`: borra **movimientos y objetos** y deja la base vacía. Úsalo antes de entregar el sistema. Después borra también las imágenes de `backend/uploads` (deja el archivo `.gitkeep`).

Los dos usan `WHERE id > 0` para funcionar con el modo seguro de Workbench. No se pueden deshacer.

## Seguridad

- El archivo `.env` está en el `.gitignore` y **nunca** debe subirse a GitHub.
- `.env.example` es solo una plantilla: no debe contener contraseñas reales.
- Las consultas a la base de datos usan parámetros (no se arma SQL con texto del usuario).
- CORS permite únicamente la dirección indicada en `FRONTEND_URL`.
- Las imágenes se validan por tipo y tamaño, y se guardan con nombres generados por el servidor.

## Autor

Bryan Franco Gomez · francobryan524@gmail.com
