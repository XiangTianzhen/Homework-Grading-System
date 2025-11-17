<template>
  <div class="question-type-selector">
    <h4>题型设置</h4>
    <div class="type-tabs">
      <button 
        v-for="type in questionTypes" 
        :key="type.value"
        @click="currentType = type.value"
        :class="{ active: currentType === type.value }"
        class="type-tab"
      >
        {{ type.label }}
      </button>
    </div>
    
    <!-- 选择题配置 -->
    <div v-if="currentType === 'choice'" class="type-config">
      <div class="choice-options">
        <div v-for="(option, index) in choiceOptions" :key="index" class="option-item">
          <span class="option-label">{{ String.fromCharCode(65 + index) }}.</span>
          <input 
            v-model="choiceOptions[index]" 
            placeholder="选项内容"
            class="option-input"
          />
          <button @click="removeOption(index)" class="remove-option">×</button>
        </div>
        <button @click="addOption" class="add-option">+ 添加选项</button>
      </div>
      
      <div class="correct-answer">
        <label>正确答案：</label>
        <select v-model="correctChoice" class="correct-select">
          <option value="">请选择</option>
          <option v-for="(option, index) in choiceOptions" :key="index" :value="index">
            {{ String.fromCharCode(65 + index) }}
          </option>
        </select>
      </div>
    </div>
    
    <!-- 填空题配置 -->
    <div v-if="currentType === 'fill'" class="type-config">
      <div class="fill-config">
        <label>填空数量：</label>
        <input 
          v-model.number="fillCount" 
          type="number" 
          min="1" 
          max="5"
          class="fill-count"
        />
      </div>
      
      <div class="fill-answers">
        <div v-for="i in fillCount" :key="i" class="fill-item">
          <span class="fill-index">第{{ i }}空：</span>
          <input 
            v-model="fillAnswers[i-1]" 
            placeholder="答案"
            class="fill-input"
          />
        </div>
      </div>
    </div>
    
    <!-- 简答题配置 -->
    <div v-if="currentType === 'essay'" class="type-config">
      <div class="essay-config">
        <label>关键词（用逗号分隔）：</label>
        <input 
          v-model="essayKeywords" 
          placeholder="例如：光合作用,叶绿体,阳光"
          class="keywords-input"
        />
        <div class="keywords-hint">系统会检测答案中是否包含这些关键词</div>
      </div>
    </div>
    
    <div class="type-actions">
      <button @click="saveConfig" class="save-btn">保存配置</button>
      <button @click="resetConfig" class="reset-btn">重置</button>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, watch } from 'vue'

const props = defineProps({
  modelValue: Object
})

const emit = defineEmits(['update:modelValue'])

const questionTypes = [
  { value: 'choice', label: '选择题' },
  { value: 'fill', label: '填空题' },
  { value: 'essay', label: '简答题' }
]

const currentType = ref('choice')
const choiceOptions = ref(['', '', '', ''])
const correctChoice = ref('')
const fillCount = ref(1)
const fillAnswers = ref([''])
const essayKeywords = ref('')

// 监听配置变化
watch([currentType, choiceOptions, correctChoice, fillCount, fillAnswers, essayKeywords], () => {
  const config = {
    type: currentType.value,
    config: getCurrentConfig()
  }
  emit('update:modelValue', config)
}, { deep: true })

function getCurrentConfig() {
  switch (currentType.value) {
    case 'choice':
      return {
        options: choiceOptions.value.filter(opt => opt.trim() !== ''),
        correctAnswer: correctChoice.value
      }
    case 'fill':
      return {
        count: fillCount.value,
        answers: fillAnswers.value.slice(0, fillCount.value)
      }
    case 'essay':
      return {
        keywords: essayKeywords.value.split(',').map(k => k.trim()).filter(k => k !== '')
      }
    default:
      return {}
  }
}

function addOption() {
  if (choiceOptions.value.length < 8) {
    choiceOptions.value.push('')
  }
}

function removeOption(index) {
  if (choiceOptions.value.length > 2) {
    choiceOptions.value.splice(index, 1)
    // 如果删除了正确答案，清空选择
    if (correctChoice.value === index) {
      correctChoice.value = ''
    } else if (correctChoice.value > index) {
      correctChoice.value = correctChoice.value - 1
    }
  }
}

function saveConfig() {
  // 验证配置
  let isValid = true
  let message = ''
  
  switch (currentType.value) {
    case 'choice':
      const validOptions = choiceOptions.value.filter(opt => opt.trim() !== '')
      if (validOptions.length < 2) {
        isValid = false
        message = '选择题至少需要2个有效选项'
      } else if (correctChoice.value === '') {
        isValid = false
        message = '请选择正确答案'
      }
      break
    case 'fill':
      const validAnswers = fillAnswers.value.slice(0, fillCount.value).filter(ans => ans.trim() !== '')
      if (validAnswers.length === 0) {
        isValid = false
        message = '请至少填写一个答案'
      }
      break
    case 'essay':
      const keywords = essayKeywords.value.split(',').map(k => k.trim()).filter(k => k !== '')
      if (keywords.length === 0) {
        isValid = false
        message = '请至少输入一个关键词'
      }
      break
  }
  
  if (isValid) {
    alert('题型配置保存成功！')
  } else {
    alert(message)
  }
}

function resetConfig() {
  currentType.value = 'choice'
  choiceOptions.value = ['', '', '', '']
  correctChoice.value = ''
  fillCount.value = 1
  fillAnswers.value = ['']
  essayKeywords.value = ''
}

// 根据外部传入的配置初始化
watch(() => props.modelValue, (newConfig) => {
  if (newConfig && newConfig.type) {
    currentType.value = newConfig.type
    if (newConfig.config) {
      switch (newConfig.type) {
        case 'choice':
          if (newConfig.config.options) {
            choiceOptions.value = [...newConfig.config.options]
          }
          if (newConfig.config.correctAnswer !== undefined) {
            correctChoice.value = newConfig.config.correctAnswer
          }
          break
        case 'fill':
          if (newConfig.config.count) {
            fillCount.value = newConfig.config.count
          }
          if (newConfig.config.answers) {
            fillAnswers.value = [...newConfig.config.answers]
          }
          break
        case 'essay':
          if (newConfig.config.keywords) {
            essayKeywords.value = newConfig.config.keywords.join(', ')
          }
          break
      }
    }
  }
}, { immediate: true })
</script>

<style scoped lang="scss">
.question-type-selector { background: #fff; border-radius: 10px; padding: 20px; margin-top: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);

  h4 { margin-bottom: 15px; color: #333 }

  .type-tabs { display: flex; gap: 10px; margin-bottom: 20px;

    .type-tab { padding: 8px 16px; border: 1px solid #ddd; background: #f5f5f5; border-radius: 5px; cursor: pointer; transition: all .3s;

      &:hover { background: #e0e0e0 }

      &.active { background: #4CAF50; color: #fff; border-color: #4CAF50 }
    }
  }

  .type-config { padding: 15px; background: #f8f9fa; border-radius: 5px; margin-bottom: 15px }

  .choice-options { margin-bottom: 15px;

    .option-item { display: flex; align-items: center; gap: 10px; margin-bottom: 10px;

      .option-label { min-width: 30px; font-weight: 600; color: #333 }

      .option-input { flex: 1; padding: 8px 12px; border: 1px solid #ccc; border-radius: 4px }

      .remove-option { background: #f44336; color: #fff; border: none; border-radius: 50%; width: 24px; height: 24px; cursor: pointer; display: flex; align-items: center; justify-content: center; &:hover { background: #d32f2f } }

    }

    .add-option { background: #4CAF50; color: #fff; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-size: 14px; &:hover { background: #45a049 } }

  }

  .correct-answer { display: flex; align-items: center; gap: 10px;

    label { font-weight: 500; color: #555 }

    .correct-select { padding: 6px 12px; border: 1px solid #ccc; border-radius: 4px; background: white }

  .fill-config { margin-bottom: 15px;

    label { font-weight: 500; color: #555; margin-right: 10px }

    .fill-count { padding: 6px 12px; border: 1px solid #ccc; border-radius: 4px; width: 80px }

  .fill-item { display: flex; align-items: center; gap: 10px; margin-bottom: 10px;

    .fill-index { min-width: 60px; font-weight: 500; color: #555 }

    .fill-input { flex: 1; padding: 8px 12px; border: 1px solid #ccc; border-radius: 4px }

  .essay-config { label { display: block; font-weight: 500; color: #555; margin-bottom: 8px }

    .keywords-input { width: 100%; padding: 8px 12px; border: 1px solid #ccc; border-radius: 4px; margin-bottom: 5px }

    .keywords-hint { font-size: 12px; color: #666; font-style: italic }
  }

  .type-actions { display: flex; gap: 10px; justify-content: flex-end;

    .save-btn { background: #4CAF50; color: #fff; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer; font-size: 14px; &:hover { background: #45a049 } }


    .reset-btn { background: #9e9e9e; color: #fff; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer; font-size: 14px; &:hover { background: #757575 } }

</style>