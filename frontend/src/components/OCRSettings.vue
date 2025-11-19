<script setup>
import { QuestionFilled } from '@element-plus/icons-vue'
const props = defineProps({
  apiChoice: { type: String, default: 'doc' },
  docOptions: Object,
  paperOptions: Object,
  handwritingOptions: Object,
  accurateOptions: Object,
  generalOptions: Object
})
const emit = defineEmits(['close'])
</script>

<template>
  <div class="settings">
    <h3>识别参数设置</h3>
    <div v-if="apiChoice==='doc'">
      <el-form label-width="160px">
        <el-form-item>
          <template #label>
            language_type
            <el-tooltip placement="top" content="识别语言类型：CHN_ENG（中英文，默认）/ ENG（英文）。"><el-icon class="tip-icon"><QuestionFilled/></el-icon></el-tooltip>
          </template>
          <el-select v-model="props.docOptions.language_type" style="width:220px"><el-option label="CHN_ENG" value="CHN_ENG"/><el-option label="ENG" value="ENG"/></el-select>
        </el-form-item>
        <el-form-item>
          <template #label>
            result_type
            <el-tooltip placement="top" content="返回级别：big（行级，默认）/ small（行+字级）。"><el-icon class="tip-icon"><QuestionFilled/></el-icon></el-tooltip>
          </template>
          <el-select v-model="props.docOptions.result_type" style="width:220px"><el-option label="big" value="big"/><el-option label="small" value="small"/></el-select>
        </el-form-item>
        <el-form-item><template #label>detect_direction<el-tooltip placement="top" content="是否检测图像朝向：true/false"><el-icon class="tip-icon"><QuestionFilled/></el-icon></el-tooltip></template><el-switch v-model="props.docOptions.detect_direction"/></el-form-item>
        <el-form-item><template #label>line_probability<el-tooltip placement="top" content="是否返回每行识别置信度"><el-icon class="tip-icon"><QuestionFilled/></el-icon></el-tooltip></template><el-switch v-model="props.docOptions.line_probability"/></el-form-item>
        <el-form-item><template #label>disp_line_poly<el-tooltip placement="top" content="是否返回每行四角点坐标"><el-icon class="tip-icon"><QuestionFilled/></el-icon></el-tooltip></template><el-switch v-model="props.docOptions.disp_line_poly"/></el-form-item>
        <el-form-item>
          <template #label>
            words_type
            <el-tooltip placement="top" content="文字类型设置"><el-icon class="tip-icon"><QuestionFilled/></el-icon></el-tooltip>
          </template>
          <el-select v-model="props.docOptions.words_type" style="width:220px"><el-option label="handwring_only" value="handwring_only"/><el-option label="handprint_mix" value="handprint_mix"/></el-select>
        </el-form-item>
        <el-form-item><template #label>layout_analysis<el-tooltip placement="top" content="版面分析输出"><el-icon class="tip-icon"><QuestionFilled/></el-icon></el-tooltip></template><el-switch v-model="props.docOptions.layout_analysis"/></el-form-item>
        <el-form-item><template #label>recg_formula<el-tooltip placement="top" content="识别公式"><el-icon class="tip-icon"><QuestionFilled/></el-icon></el-tooltip></template><el-switch v-model="props.docOptions.recg_formula"/></el-form-item>
        <el-form-item><template #label>recg_long_division<el-tooltip placement="top" content="识别竖式"><el-icon class="tip-icon"><QuestionFilled/></el-icon></el-tooltip></template><el-switch v-model="props.docOptions.recg_long_division"/></el-form-item>
        <el-form-item><template #label>disp_underline_analysis<el-tooltip placement="top" content="下划线识别"><el-icon class="tip-icon"><QuestionFilled/></el-icon></el-tooltip></template><el-switch v-model="props.docOptions.disp_underline_analysis"/></el-form-item>
        <el-form-item><template #label>recg_alter<el-tooltip placement="top" content="涂改识别"><el-icon class="tip-icon"><QuestionFilled/></el-icon></el-tooltip></template><el-switch v-model="props.docOptions.recg_alter"/></el-form-item>
      </el-form>
    </div>
    <div v-else-if="apiChoice==='paper'">
      <el-form label-width="160px">
        <el-form-item><template #label>language_type<el-tooltip placement="top" content="识别语言类型"><el-icon class="tip-icon"><QuestionFilled/></el-icon></el-tooltip></template><el-select v-model="props.paperOptions.language_type" style="width:220px"><el-option label="CHN_ENG" value="CHN_ENG"/><el-option label="ENG" value="ENG"/></el-select></el-form-item>
        <el-form-item><template #label>detect_direction<el-tooltip placement="top" content="朝向检测"><el-icon class="tip-icon"><QuestionFilled/></el-icon></el-tooltip></template><el-switch v-model="props.paperOptions.detect_direction"/></el-form-item>
        <el-form-item><template #label>words_type<el-tooltip placement="top" content="文字类型"><el-icon class="tip-icon"><QuestionFilled/></el-icon></el-tooltip></template><el-select v-model="props.paperOptions.words_type" style="width:220px"><el-option label="handwring_only" value="handwring_only"/><el-option label="handprint_mix" value="handprint_mix"/></el-select></el-form-item>
        <el-form-item><template #label>splice_text<el-tooltip placement="top" content="元素文本拼接"><el-icon class="tip-icon"><QuestionFilled/></el-icon></el-tooltip></template><el-switch v-model="props.paperOptions.splice_text"/></el-form-item>
        <el-form-item><template #label>enhance<el-tooltip placement="top" content="图像矫正与增强"><el-icon class="tip-icon"><QuestionFilled/></el-icon></el-tooltip></template><el-switch v-model="props.paperOptions.enhance"/></el-form-item>
      </el-form>
    </div>
    <div v-else-if="apiChoice==='handwriting'">
      <el-form label-width="160px">
        <el-form-item><template #label>language_type<el-tooltip placement="top" content="识别语言类型"><el-icon class="tip-icon"><QuestionFilled/></el-icon></el-tooltip></template><el-select v-model="props.handwritingOptions.language_type" style="width:220px"><el-option label="CHN_ENG" value="CHN_ENG"/><el-option label="ENG" value="ENG"/></el-select></el-form-item>
        <el-form-item><template #label>recognize_granularity<el-tooltip placement="top" content="字符级定位"><el-icon class="tip-icon"><QuestionFilled/></el-icon></el-tooltip></template><el-select v-model="props.handwritingOptions.recognize_granularity" style="width:220px"><el-option label="big" value="big"/><el-option label="small" value="small"/></el-select></el-form-item>
        <el-form-item><template #label>probability<el-tooltip placement="top" content="返回置信度"><el-icon class="tip-icon"><QuestionFilled/></el-icon></el-tooltip></template><el-switch v-model="props.handwritingOptions.probability"/></el-form-item>
        <el-form-item><template #label>detect_direction<el-tooltip placement="top" content="朝向检测"><el-icon class="tip-icon"><QuestionFilled/></el-icon></el-tooltip></template><el-switch v-model="props.handwritingOptions.detect_direction"/></el-form-item>
        <el-form-item><template #label>detect_alteration<el-tooltip placement="top" content="涂改检测"><el-icon class="tip-icon"><QuestionFilled/></el-icon></el-tooltip></template><el-switch v-model="props.handwritingOptions.detect_alteration"/></el-form-item>
      </el-form>
    </div>
    <div v-else-if="apiChoice==='accurate'">
      <el-form label-width="160px">
        <el-form-item><template #label>language_type<el-tooltip placement="top" content="识别语言类型"><el-icon class="tip-icon"><QuestionFilled/></el-icon></el-tooltip></template><el-select v-model="props.accurateOptions.language_type" style="width:220px"><el-option label="CHN_ENG" value="CHN_ENG"/><el-option label="ENG" value="ENG"/></el-select></el-form-item>
        <el-form-item><template #label>detect_direction<el-tooltip placement="top" content="朝向检测"><el-icon class="tip-icon"><QuestionFilled/></el-icon></el-tooltip></template><el-switch v-model="props.accurateOptions.detect_direction"/></el-form-item>
        <el-form-item><template #label>paragraph<el-tooltip placement="top" content="输出段落信息"><el-icon class="tip-icon"><QuestionFilled/></el-icon></el-tooltip></template><el-switch v-model="props.accurateOptions.paragraph"/></el-form-item>
        <el-form-item><template #label>probability<el-tooltip placement="top" content="返回置信度"><el-icon class="tip-icon"><QuestionFilled/></el-icon></el-tooltip></template><el-switch v-model="props.accurateOptions.probability"/></el-form-item>
        <el-form-item><template #label>multidirectional_recognize<el-tooltip placement="top" content="多方向识别"><el-icon class="tip-icon"><QuestionFilled/></el-icon></el-tooltip></template><el-switch v-model="props.accurateOptions.multidirectional_recognize"/></el-form-item>
      </el-form>
    </div>
    <div v-else>
      <el-form label-width="160px">
        <el-form-item><template #label>language_type<el-tooltip placement="top" content="识别语言类型"><el-icon class="tip-icon"><QuestionFilled/></el-icon></el-tooltip></template><el-select v-model="props.generalOptions.language_type" style="width:220px"><el-option label="CHN_ENG" value="CHN_ENG"/><el-option label="ENG" value="ENG"/></el-select></el-form-item>
        <el-form-item><template #label>detect_direction<el-tooltip placement="top" content="朝向检测"><el-icon class="tip-icon"><QuestionFilled/></el-icon></el-tooltip></template><el-switch v-model="props.generalOptions.detect_direction"/></el-form-item>
        <el-form-item><template #label>detect_language<el-tooltip placement="top" content="语言检测"><el-icon class="tip-icon"><QuestionFilled/></el-icon></el-tooltip></template><el-switch v-model="props.generalOptions.detect_language"/></el-form-item>
        <el-form-item><template #label>paragraph<el-tooltip placement="top" content="输出段落信息"><el-icon class="tip-icon"><QuestionFilled/></el-icon></el-tooltip></template><el-switch v-model="props.generalOptions.paragraph"/></el-form-item>
        <el-form-item><template #label>probability<el-tooltip placement="top" content="返回置信度"><el-icon class="tip-icon"><QuestionFilled/></el-icon></el-tooltip></template><el-switch v-model="props.generalOptions.probability"/></el-form-item>
      </el-form>
    </div>
    <div style="text-align:right;margin-top:10px"><button class="btn" @click="emit('close')">关闭</button></div>
  </div>
</template>

<style scoped>
.settings { max-width: 720px }
.tip-icon { margin-left: 6px; cursor: help; vertical-align: middle }
.btn { background: #2196F3; color: #fff; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer }
</style>