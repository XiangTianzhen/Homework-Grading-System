<template>
  <div class="answer-editor">
    <h4>标准答案设置</h4>
    <div class="answer-list">
      <div v-for="(item, i) in answers" :key="i" class="answer-item">
        <span class="index">第{{ i + 1 }}题</span>
        <input v-model="item.answer" placeholder="正确答案" />
        <input v-model.number="item.score" type="number" min="1" placeholder="分值" />
        <button @click="remove(i)" class="remove">删除</button>
      </div>
    </div>
    <div class="add-row">
      <button @click="add" class="add">+ 添加题目</button>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'

const props = defineProps({ modelValue: Array })
const emit = defineEmits(['update:modelValue'])

const answers = ref(props.modelValue)
watch(answers, () => emit('update:modelValue', answers.value), { deep: true })

function add() {
  answers.value.push({ answer: '', score: 10 })
}
function remove(i) {
  answers.value.splice(i, 1)
}
</script>

<style scoped lang="scss">
// 标准答案编辑器样式（嵌套结构便于维护）
.answer-editor {
  background: #fff; border-radius: 10px; padding: 20px; margin-top: 20px;
  .answer-list { display: flex; flex-direction: column; gap: 10px;
    .answer-item { display: flex; align-items: center; gap: 10px;
      .index { min-width: 60px; font-weight: 600 }
      input { flex: 1; padding: 8px 10px; border: 1px solid #ccc; border-radius: 6px;
        &[type=number] { flex: 0 0 80px }
      }
      button.remove { background: #f44336; color: #fff; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer }
    }
  }
  .add-row { margin-top: 15px; text-align: right;
    button.add { background: #4CAF50; color: #fff; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer }
  }
}
</style>