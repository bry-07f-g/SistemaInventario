// Una TRANSACCIÓN es un grupo de pasos que se guardan juntos o no se guarda
// ninguno. Ejemplo: al crear un objeto hay que (1) crear el producto y
// (2) anotar su primer ingreso. Si el paso 2 falla, el paso 1 se deshace
// solo, y nunca queda un objeto a medias.
//
// Uso:
//   const resultado = await conTransaccion(async (conexion) => {
//     await conexion.execute('INSERT ...')
//     await conexion.execute('UPDATE ...')
//     return algo
//   })
//
// Todos los pasos deben usar la "conexion" que se recibe, no el pool:
// la transacción vive dentro de UNA sola conexión.
const pool = require('../config/database')

async function conTransaccion(trabajo) {
  // Tomamos una conexión del pool solo para nosotros
  const conexion = await pool.getConnection()
  try {
    await conexion.beginTransaction() // empieza a "anotar a lápiz"
    const resultado = await trabajo(conexion)
    await conexion.commit() // todo salió bien: se guarda "con tinta"
    return resultado
  } catch (error) {
    try {
      await conexion.rollback() // algo falló: se borra todo lo anotado
    } catch (errorRollback) {
      // Si hasta el rollback falla (se cayó la conexión), lo anotamos,
      // pero lanzamos el error ORIGINAL, que es el importante.
      console.error('No se pudo deshacer la transacción:', errorRollback.message)
    }
    throw error
  } finally {
    // Pase lo que pase, devolvemos la conexión al pool
    conexion.release()
  }
}

module.exports = { conTransaccion }