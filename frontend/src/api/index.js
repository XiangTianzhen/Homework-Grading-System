import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 30000
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err.response?.status
    const serverMsg = err.response?.data?.error || err.response?.data?.message
    let msg = ''
    if (status === 400) msg = '请求参数错误'
    else if (status === 404) msg = '资源不存在或文件未找到'
    else if (status === 413) msg = '请求体过大，请减少裁剪图片数量或大小'
    else if (status === 500) msg = '服务器内部错误'
    else msg = '网络异常或服务不可用'
    if (serverMsg) msg = `${msg}：${serverMsg}`
    return Promise.reject(new Error(msg))
  }
)

export const uploadPaper = (formData) =>
  api.post('/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } })

export const recognizeOCR = (filename, options = {}) =>
  api.post('/ocr', { filename, options })

export const gradePaper = (answers, studentAnswers) =>
  api.post('/grade', { answers, studentAnswers })

export const recognizeOCRWithAreas = (filename, areas, options = {}) =>
  api.post('/ocr/areas', { filename, areas, options })

export const paperCutEdu = (filename, options = {}) =>
  api.post('/paper-cut', { filename, options })

export const paperCutByImages = (images, options = {}) =>
  api.post('/paper-cut/images', { images, options })

export const handwritingAreas = (filename, areas, options = {}) =>
  api.post('/ocr/handwriting/areas', { filename, areas, options })

export const accurateAreas = (filename, areas, options = {}) =>
  api.post('/ocr/accurate/areas', { filename, areas, options })

export const generalAreas = (filename, areas, options = {}) =>
  api.post('/ocr/general/areas', { filename, areas, options })

export const handwritingByImages = (images, options = {}) =>
  api.post('/ocr/handwriting/images', { images, options })

export const accurateByImages = (images, options = {}) =>
  api.post('/ocr/accurate/images', { images, options })

export const generalByImages = (images, options = {}) =>
  api.post('/ocr/general/images', { images, options })

export const docByImages = (images, options = {}) =>
  api.post('/ocr/doc/images', { images, options })

export const handwritingWhole = (filename, options = {}) =>
  api.post('/ocr/handwriting', { filename, options })

export const accurateWhole = (filename, options = {}) =>
  api.post('/ocr/accurate', { filename, options })

export const generalWhole = (filename, options = {}) =>
  api.post('/ocr/general', { filename, options })

export const batchProcess = (files) => {
  const formData = new FormData()
  files.forEach(file => formData.append('papers', file))
  return api.post('/batch', formData, { headers: { 'Content-Type': 'multipart/form-data' } })
}

export default api