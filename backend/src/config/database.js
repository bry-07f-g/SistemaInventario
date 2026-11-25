// Conexión a MySQL.
//
// En vez de abrir una conexión nueva por cada consulta (lento), creamos un
// "pool": un grupo de conexiones ya abiertas que se reutilizan. Cuando una
// consulta termina, su conexión queda libre para la siguiente.
//
// "mysql2/promise" permite usar async/await en lugar de callbacks.
const mysql = require('mysql2/promise')

// Los datos de conexión NO se escriben aquí: se leen de las variables de
// entorno (archivo .env). Así la contraseña nunca queda en el código.
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,

  // Si las 10 conexiones están ocupadas, las consultas nuevas esperan su turno
  waitForConnections: true,
  connectionLimit: 10,

  // Permite guardar y leer tildes, ñ y emojis sin que se dañen
  // Permite guardar y leer tildes, ñ y emojis sin que se dañen
  charset: 'utf8mb4',

  // Mantiene viva cada conexión inactiva (algunas bases en la nube cierran
  // las conexiones que llevan mucho rato sin usarse)
  enableKeepAlive: true,

  // Conexión cifrada (SSL/TLS). Las bases en la nube, como TiDB Cloud, la
  // EXIGEN. En tu computador no hace falta, por eso solo se activa si en el
  // .env está DB_SSL=true. "rejectUnauthorized" obliga a comprobar que el
  // servidor es realmente el de la base y no un impostor.
  ssl:
    process.env.DB_SSL === 'true'
      ? { minVersion: 'TLSv1.2', rejectUnauthorized: true }
      : undefined,
})

// "module.exports" es lo que este archivo entrega a los demás archivos
// que escriban: require('../config/database')
module.exports = pool