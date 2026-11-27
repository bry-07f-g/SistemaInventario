import { useState } from 'react'

// Divide una lista en páginas. Devuelve:
//  - visibles: los elementos de la página actual
//  - pagina / setPagina: la página actual (empieza en 1) y cómo cambiarla
//  - totalPaginas, total, desde, hasta: para el texto "Mostrando 1–5 de 23"
export function usePaginacion(lista, porPagina) {
  const [pagina, setPagina] = useState(1)

  const totalPaginas = Math.max(1, Math.ceil(lista.length / porPagina))
  // Si la lista se achicó (se borró algo o se buscó), la página guardada
  // puede ya no existir: se usa la última que sí existe.
  const actual = Math.min(pagina, totalPaginas)
  const inicio = (actual - 1) * porPagina

  return {
    visibles: lista.slice(inicio, inicio + porPagina),
    pagina: actual,
    setPagina,
    totalPaginas,
    total: lista.length,
    desde: lista.length === 0 ? 0 : inicio + 1,
    hasta: Math.min(inicio + porPagina, lista.length),
  }
}