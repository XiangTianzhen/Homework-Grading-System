<template>
  <div class="answer-editor">
    <h4>标准答案设置</h4>
    <div class="answer-list">
      <div v-for="(item, i) in answers" :key="i" class="answer-item">
        <span class="index">第{{ i + 1 }}题</span>
        <el-select v-model="item.type" class="type" placeholder="题型">
          <el-option label="选择" value="choice" />
          <el-option label="判断" value="judge" />
          <el-option label="填空" value="fill" />
        </el-select>
        <template v-if="item.type==='judge'">
          <el-select v-model="item.answer" class="value" placeholder="选择答案">
            <el-option label="√" value="√" />
            <el-option label="×" value="×" />
          </el-select>
        </template>
        <template v-else-if="item.type==='choice'">
          <el-select v-model="item.answer" class="value" placeholder="选择答案" v-if="!item.custom">
            <el-option label="A" value="A" />
            <el-option label="B" value="B" />
            <el-option label="C" value="C" />
            <el-option label="D" value="D" />
          </el-select>
          <input v-else v-model="item.answer" placeholder="自定义答案" />
          <button class="settings" @click="toggleCustom(item)">{{ item.custom ? '使用ABCD' : '设置' }}</button>
        </template>
        <template v-else>
          <input v-model="item.answer" placeholder="正确答案" />
        </template>
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
  answers.value.push({ type: 'choice', answer: '', score: 10, custom: false })
}
function remove(i) {
  answers.value.splice(i, 1)
}
function toggleCustom(item) { item.custom = !item.custom; if (!item.custom && !['A','B','C','D'].includes(item.answer)) item.answer = '' }
</script>

<style scoped lang="scss">
// 标准答案编辑器样式（嵌套结构便于维护）
.answer-editor {
  background: #fff; border-radius: 10px; padding: 20px; margin-top: 20px;
  .answer-list { display: flex; flex-direction: column; gap: 10px;
    .answer-item { display: flex; align-items: center; gap: 10px;
      .index { min-width: 60px; font-weight: 600 }
      .type { flex: 0 0 120px }
      .value { flex: 0 0 120px }
      input { flex: 1; padding: 8px 10px; border: 1px solid #ccc; border-radius: 6px;
        &[type=number] { flex: 0 0 80px }
      }
      .settings { background: #ff9800; color: #fff; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer }
      button.remove { background: #f44336; color: #fff; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer }
    }
  }
  .add-row { margin-top: 15px; text-align: right;
    button.add { background: #4CAF50; color: #fff; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer }
  }
}
</style>