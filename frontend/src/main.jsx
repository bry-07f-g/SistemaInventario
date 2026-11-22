import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// BrowserRouter permite que la página tenga "direcciones" (rutas) distintas
import { BrowserRouter } from 'react-router-dom'

// Importamos los estilos. Primero las variables (colores) y luego los globales,
// porque los globales usan las variables.
import './styles/variables.css'
import './styles/global.css'

import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {/* Todo lo que esté dentro de BrowserRouter puede usar rutas */}
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)