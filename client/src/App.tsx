import { Route, Routes } from 'react-router-dom'
import UploadPage from './pages/UploadPage'
import DocumentPage from './pages/DocumentPage'

function App() {
  return (
    <Routes>
      <Route path="/" element={<UploadPage />} />
      <Route path="/documents/:filename" element={<DocumentPage />} />
    </Routes>
  )
}

export default App
