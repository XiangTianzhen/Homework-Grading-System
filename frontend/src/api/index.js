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

export default api