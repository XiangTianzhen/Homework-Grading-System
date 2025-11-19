// 前端 API 封装：统一与后端交互的请求方法（OCR/上传/评分/分片识别等）
import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 30000
})

// 统一错误处理：将服务端状态码与 message 映射为中文错误
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

// 上传试卷图片（FormData: paper）
export const uploadPaper = (formData) =>
  api.post('/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } })

// 试卷分析与识别（doc_analysis）整图识别
export const recognizeOCR = (filename, options = {}) =>
  api.post('/ocr', { filename, options })

// 评分接口：标准答案 + 学生答案
export const gradePaper = (answers, studentAnswers) =>
  api.post('/grade', { answers, studentAnswers })

// 旧版通用区域识别（保留）
export const recognizeOCRWithAreas = (filename, areas, options = {}) =>
  api.post('/ocr/areas', { filename, areas, options })

// 试卷切题识别（整图）
export const paperCutEdu = (filename, options = {}) =>
  api.post('/paper-cut', { filename, options })

// 试卷切题识别（分片图片）
export const paperCutByImages = (images, options = {}) =>
  api.post('/paper-cut/images', { images, options })

// 手写文字识别（区域）
export const handwritingAreas = (filename, areas, options = {}) =>
  api.post('/ocr/handwriting/areas', { filename, areas, options })

// 通用文字识别（高精度版）区域
export const accurateAreas = (filename, areas, options = {}) =>
  api.post('/ocr/accurate/areas', { filename, areas, options })

// 通用文字识别（标准版）区域
export const generalAreas = (filename, areas, options = {}) =>
  api.post('/ocr/general/areas', { filename, areas, options })

// 手写文字识别（分片图片）
export const handwritingByImages = (images, options = {}) =>
  api.post('/ocr/handwriting/images', { images, options })

// 高精度版（分片图片）
export const accurateByImages = (images, options = {}) =>
  api.post('/ocr/accurate/images', { images, options })

// 标准版（分片图片）
export const generalByImages = (images, options = {}) =>
  api.post('/ocr/general/images', { images, options })

// doc_analysis（分片图片）
export const docByImages = (images, options = {}) =>
  api.post('/ocr/doc/images', { images, options })

// 手写文字识别（整图）
export const handwritingWhole = (filename, options = {}) =>
  api.post('/ocr/handwriting', { filename, options })

// 高精度版（整图）
export const accurateWhole = (filename, options = {}) =>
  api.post('/ocr/accurate', { filename, options })

// 标准版（整图）
export const generalWhole = (filename, options = {}) =>
  api.post('/ocr/general', { filename, options })

// 批量处理（多文件上传）
export const batchProcess = (files) => {
  const formData = new FormData()
  files.forEach(file => formData.append('papers', file))
  return api.post('/batch', formData, { headers: { 'Content-Type': 'multipart/form-data' } })
}

export default api