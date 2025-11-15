import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 30000
})

export const uploadPaper = (formData) =>
  api.post('/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } })

export const recognizeOCR = (filename) =>
  api.post('/ocr', { filename })

export const gradePaper = (answers, studentAnswers) =>
  api.post('/grade', { answers, studentAnswers })

export const recognizeOCRWithAreas = (filename, areas) =>
  api.post('/ocr/areas', { filename, areas })

export const batchProcess = (files) => {
  const formData = new FormData()
  files.forEach(file => formData.append('papers', file))
  return api.post('/batch', formData, { headers: { 'Content-Type': 'multipart/form-data' } })
}

export default api