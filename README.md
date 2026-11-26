# SistemaInventario

Sistema web de **gestión de inventario para varias empresas**. Cada empresa tiene su propio inventario; los usuarios inician sesión y solo ven y hacen lo que el super administrador les permite. Permite registrar objetos con su imagen, ver cuántas unidades hay, ingresar o despachar mercancía y consultar el historial de movimientos.

**Versión 2.0** · Sitio publicado: <https://sistema-inventario-beta-ten.vercel.app>

## Funciones

- **Inicio de sesión** con correo y contraseña. La sesión se recuerda en el navegador (60 días) y se cierra sola si el administrador desactiva la cuenta o cambia la contraseña.
- **Varias empresas (inventarios):** cada objeto y cada movimiento pertenece a una empresa. Un selector con búsqueda en tiempo real permite cambiar de empresa.
- **Roles y permisos:**
  - **Super administrador:** ve y hace todo, en todas las empresas. Gestiona usuarios y empresas. Se crea desde la configuración del servidor y nadie lo puede quitar desde la página.
  - **Usuarios:** por cada empresa se eligen sus permisos: _ver, crear, editar, eliminar, ingresar, despachar_. Sin ningún permiso en una empresa, no la ven.
- **Objetos:** nombre, cantidad, descripción, imagen y cantidad mínima. Crear, ver, editar y eliminar.
- **Estados de stock:** _normal_ (verde), _próximo a agotar_ (amarillo, cantidad igual o menor a la mínima) y _agotado_ (rojo).
- **Ingresar o despachar:** cada movimiento guarda quién entregó, quién recibió y qué usuario del sistema lo registró. No se puede despachar más de lo que hay.
- **Historial:** pantalla propia, con el usuario que registró cada movimiento. Se conserva aunque se elimine el objeto o el usuario.
- **Pantallas del super administrador:**
  - **Usuarios:** lista con buscador y resumen; crear, editar, desactivar, asignar contraseña nueva, eliminar y elegir permisos por empresa (con la explicación de cada permiso).
  - **Empresas:** crear, renombrar y eliminar (solo si están vacías).

## Tecnologías

| Parte         | Tecnología                                                                                               |
| ------------- | -------------------------------------------------------------------------------------------------------- |
| Frontend      | React 19, Vite, React Router                                                                             |
| Backend       | Node.js, Express 5, mysql2, multer, bcryptjs, jsonwebtoken, express-rate-limit, cloudinary, cors, dotenv |
| Base de datos | MySQL 8 (local) · TiDB Cloud (publicado)                                                                 |
| Publicación   | Vercel (frontend) · Render (backend) · Cloudinary (imágenes)                                             |

## Estructura del proyecto

```
SistemaInventario/
├── backend/
│   ├── database/        schema.sql, migracion_v2.sql, limpiar_historial.sql, reiniciar_todo.sql
│   ├── src/
│   │   ├── config/      conexión a MySQL
│   │   ├── controllers/ lógica de sesión, productos, movimientos, inventarios y usuarios
│   │   ├── middlewares/ sesión y permisos (auth.js), subida de imágenes (upload.js)
│   │   ├── routes/      direcciones de la API
│   │   ├── scripts/     reiniciarAdmin.js (recuperar la contraseña del super admin)
│   │   ├── utils/       validaciones, transacciones, errores, sesión, imágenes, super admin
│   │   ├── app.js       configuración de Express
│   │   └── server.js    arranque del servidor
│   ├── uploads/         imágenes en local (no se sube a Git)
│   └── .env.example     plantilla de variables de entorno
└── frontend/
    ├── src/
    │   ├── components/  Header, selectores, formularios, modal, historial
    │   ├── pages/       Login, Productos, Movimientos, Historial, Usuarios, Empresas
    │   ├── services/    api.js (toda la comunicación con el backend y la sesión)
    │   ├── styles/      variables.css y global.css
    │   └── utils/       estado de stock, búsqueda y permisos
    └── vercel.json      hace que las rutas (/historial, /usuarios...) funcionen al recargar
```

## Requisitos

- [Node.js](https://nodejs.org/) (versión LTS reciente)
- [MySQL 8](https://dev.mysql.com/downloads/) (se recomienda también MySQL Workbench)

## Instalación y uso en local

### 1. Base de datos

- **Instalación nueva:** en Workbench ejecuta completo `backend/database/schema.sql`.
- **Si ya tenías la versión 1 con datos:** ejecuta una sola vez `backend/database/migracion_v2.sql`. Todo lo que había pasa a una empresa llamada "Inventario 1".

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
JWT_SECRET=una_clave_larga_y_al_azar_de_32_o_mas
SUPERADMIN_NOMBRE=Nombre del administrador
SUPERADMIN_EMAIL=correo@ejemplo.com
SUPERADMIN_PASSWORD=contraseña_de_8_o_mas
```

Para generar el `JWT_SECRET` sin que se vea en pantalla (PowerShell):

```powershell
node -e "process.stdout.write(require('crypto').randomBytes(48).toString('hex'))" | Set-Clipboard
```

Inicia el servidor:

```bash
npm run dev      # desarrollo (se reinicia solo al guardar)
npm start        # normal
```

La primera vez aparece `Super administrador creado: ...`. Para comprobar que funciona, abre <http://localhost:3000/api/salud>.

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

Abre <http://localhost:5173> e inicia sesión con el correo y la contraseña del super administrador. Si el backend está en otra dirección, crea `frontend/.env` con `VITE_API_URL=http://direccion-del-backend`.

## Super administrador

- Se crea solo al arrancar el servidor con `SUPERADMIN_NOMBRE`, `SUPERADMIN_EMAIL` y `SUPERADMIN_PASSWORD`. Si ya existe, no se toca su contraseña.
- **Olvidó su contraseña:** pon la nueva en `SUPERADMIN_PASSWORD` y ejecuta, en la carpeta `backend`:

```bash
npm run reiniciar-admin
```

**En Render** (sin terminal): cambia `SUPERADMIN_PASSWORD`, agrega `SUPERADMIN_REINICIAR=true` y guarda. Cuando el servicio esté _live_, **borra** `SUPERADMIN_REINICIAR` y guarda otra vez.

- **Cambiar de super administrador** (por ejemplo, entregarle el sistema a otra persona): cambia `SUPERADMIN_NOMBRE`, `SUPERADMIN_EMAIL` y `SUPERADMIN_PASSWORD` (en `.env` o en Render) y reinicia el servidor. Se crea el nuevo super administrador y el anterior pasa a ser un usuario normal sin permisos (sus sesiones se cierran); después se puede eliminar o darle permisos desde _Usuarios_. Solo hay un super administrador a la vez.
- **Otro usuario olvidó su contraseña:** el super administrador le asigna una nueva en _Usuarios → Ver / editar → Asignar una contraseña nueva_.

## API

Todas las rutas, salvo `/api/salud` y `/api/auth/login`, exigen el encabezado `Authorization: Bearer <token>`. Las de productos y movimientos exigen además `X-Inventario-Id: <id de la empresa>`.

| Método              | Ruta                         | Qué hace                                              | Permiso              |
| ------------------- | ---------------------------- | ----------------------------------------------------- | -------------------- |
| GET                 | `/api/salud`                 | Comprueba el servidor y la base de datos              | —                    |
| POST                | `/api/auth/login`            | Inicia sesión (máx. 10 intentos fallidos cada 15 min) | —                    |
| GET                 | `/api/auth/yo`               | Usuario de la sesión y sus empresas con permisos      | sesión               |
| GET                 | `/api/productos`             | Lista los objetos de la empresa                       | ver                  |
| POST                | `/api/productos`             | Crea un objeto (imagen opcional) y su entrada inicial | crear + ingresar     |
| PUT                 | `/api/productos/:id`         | Edita nombre, descripción, cantidad mínima e imagen   | editar               |
| DELETE              | `/api/productos/:id`         | Elimina el objeto (el historial se conserva)          | eliminar             |
| GET                 | `/api/movimientos`           | Historial de la empresa                               | ver                  |
| POST                | `/api/movimientos`           | Registra una entrada o una salida                     | ingresar / despachar |
| GET/POST/PUT/DELETE | `/api/inventarios`           | Gestión de empresas                                   | super admin          |
| GET/POST/PUT/DELETE | `/api/usuarios`              | Gestión de usuarios y permisos                        | super admin          |
| PUT                 | `/api/usuarios/:id/password` | Asigna una contraseña nueva                           | super admin          |

Errores principales: `400` datos inválidos, `401` falta iniciar sesión, `403` sin permiso, `404` no existe, `409` conflicto (nombre repetido, stock insuficiente), `429` demasiados intentos, `503` base de datos no disponible.

## Decisiones de diseño

- **Seguridad en el servidor:** el frontend oculta los botones que el usuario no puede usar, pero quien decide es el backend, que revisa la sesión y el permiso en cada petición.
- **Contraseñas:** se guardan solo como _hash_ (bcrypt). El mensaje de error de login es el mismo si falla el correo o la contraseña.
- **Sesión con token (JWT):** firmado con `JWT_SECRET`. Cada usuario tiene una `version_sesion`; al cambiarle la contraseña o desactivarlo, sube y sus sesiones abiertas dejan de servir.
- **Datos separados por empresa:** todas las consultas filtran por la empresa elegida, así nadie puede tocar datos de otra cambiando un número en la dirección.
- **Cantidad actual:** vive en el producto y solo cambia con entradas y salidas, así el historial siempre cuadra.
- **Movimientos con transacción:** cada ingreso o despacho bloquea la fila del producto mientras se guarda; dos despachos simultáneos no pueden dejar el stock en negativo.
- **Historial permanente:** cada movimiento guarda el nombre del objeto y del usuario, por eso sigue siendo legible aunque se eliminen.
- **Imágenes:** en local se guardan en `backend/uploads`; publicado, en Cloudinary. En la base solo se guarda la ruta o la dirección. JPG, PNG, WEBP y GIF de hasta 5 MB.
- **Empresas protegidas:** no se puede eliminar una empresa que tenga objetos o historial.

## Diseño visual

- Persimmon `#E45B11`: color principal (bordes, botones, encabezado).
- Blood Orange `#B50001`: alertas, eliminar y agotado.
- Verde `#2E7D32`: stock normal y mensajes de éxito.
- Ámbar `#F6B50F`: próximo a agotar.

## Publicación (deploy)

| Servicio                 | Qué aloja     | Configuración clave                                                                                                                                           |
| ------------------------ | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **TiDB Cloud** (Starter) | Base de datos | Ejecutar `schema.sql` (nueva) o `migracion_v2.sql` (si venía de la v1) desde el SQL Editor                                                                    |
| **Render** (Web Service) | Backend       | Root `backend`, `npm install` / `npm start`. Variables: `NODE_VERSION`, `DB_*`, `DB_SSL=true`, `FRONTEND_URL`, `CLOUDINARY_URL`, `JWT_SECRET`, `SUPERADMIN_*` |
| **Vercel**               | Frontend      | Root `frontend`. Variable `VITE_API_URL` = dirección de Render                                                                                                |
| **Cloudinary**           | Imágenes      | `CLOUDINARY_URL=cloudinary://API_KEY:API_SECRET@CLOUD_NAME` (solo en Render)                                                                                  |

Render y Vercel publican solos cada cambio que llega a la rama `main`. El plan gratuito de Render "se duerme" tras un rato sin uso: el primer ingreso del día puede tardar hasta un minuto.

## Mantenimiento de los datos

En `backend/database/` (ejecutar desde Workbench o el SQL Editor de TiDB):

- `limpiar_historial.sql`: borra **solo los movimientos** de todas las empresas.
- `reiniciar_todo.sql`: borra **movimientos y objetos** de todas las empresas. Los usuarios y las empresas se conservan. Después borra las imágenes (en Cloudinary: _Media Library → carpeta inventario_).
  No se pueden deshacer.

## Seguridad

- El archivo `.env` está en el `.gitignore` y **nunca** debe subirse a GitHub. `.env.example` es solo una plantilla.
- Las claves de producción (`DB_PASSWORD`, `JWT_SECRET`, `CLOUDINARY_URL`, `SUPERADMIN_PASSWORD`) viven solo en el panel de Render.
- Consultas con parámetros (sin SQL armado con texto del usuario).
- CORS permite únicamente la dirección de `FRONTEND_URL`.
- Límite de intentos en el inicio de sesión.

## Autor

Bryan Franco Gomez · francobryan524@gmail.com
