/**
 * AI Vision Service — 通义千问 VL 图片识别
 *
 * 支持功能：
 *   - 单图识别（URL 或 Base64）
 *   - 多图对比分析
 *   - OCR 文字提取
 *   - 预设提示词模板
 *
 * API: 阿里云 DashScope 兼容 OpenAI 接口
 */

import OpenAI from 'openai';
import * as fs from 'fs';
import * as path from 'path';

// ─── 配置 ────────────────────────────────────────────────────

const DEFAULT_BASE_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1';
const DEFAULT_MODEL = 'qwen3.6-flash';

/** 支持的模型 */
export const QWEN_VL_MODELS = {
  flash: 'qwen3.6-flash',
  max: 'qwen-vl-max',
  ocr: 'qwen-vl-ocr-latest',
} as const;

// ─── 预设提示词模板 ─────────────────────────────────────────

export interface PromptTemplate {
  id: string;
  label: string;
  description: string;
  prompt: string;
  model?: string;
}

export const PROMPT_TEMPLATES: PromptTemplate[] = [
  {
    id: 'general',
    label: '通用描述',
    description: '详细描述图片内容',
    prompt: '请详细描述这张图片的内容',
  },
  {
    id: 'extract-title',
    label: '提取商品标题',
    description: '从商品图片中提取标题',
    prompt: '这是一张电商商品图片。请提取商品标题/名称，只输出标题文本，不要额外解释。',
  },
  {
    id: 'extract-price',
    label: '提取价格',
    description: '从商品图片中识别价格',
    prompt: '这是一张电商商品图片。请提取图中所有价格信息（原价、促销价等），以 JSON 格式输出：{"prices": [{"label": "价格类型", "value": "金额"}]}',
  },
  {
    id: 'extract-specs',
    label: '提取规格参数',
    description: '从商品图中提取规格信息',
    prompt: '这是一张电商商品图片。请提取所有规格参数（尺寸、材质、颜色、重量等），以 JSON 格式输出：{"specifications": {"参数名": "参数值"}}',
  },
  {
    id: 'extract-features',
    label: '提取卖点',
    description: '从商品图中提炼核心卖点',
    prompt: '这是一张电商商品图片。请提炼商品的核心卖点，以简洁的列表形式输出，每条不超过20个字。',
  },
  {
    id: 'ocr',
    label: 'OCR 文字提取',
    description: '提取图中所有文字',
    prompt: '提取图中所有文字，保持原始排版格式输出',
    model: 'qwen-vl-ocr-latest',
  },
  {
    id: 'listing-copy',
    label: '生成 Listing 文案',
    description: '根据商品图生成 Amazon Listing',
    prompt: '这是一张电商商品图片。请根据图片内容生成一份 Amazon 商品 Listing，包含：\n1. 标题（200字符以内，关键词丰富）\n2. 五点描述（每点一行，以大写关键词开头）\n3. 搜索关键词（逗号分隔）',
  },
  {
    id: 'compare-products',
    label: '商品对比分析',
    description: '对比多张商品图的差异',
    prompt: '请对比这些商品图片，分析它们的差异，包括外观、功能、材质等方面，给出清晰的对比结论。',
    model: 'qwen-vl-max',
  },
];

/** 根据 ID 查找模板 */
export function getPromptTemplate(id: string): PromptTemplate | undefined {
  return PROMPT_TEMPLATES.find(t => t.id === id);
}

// ─── Service ─────────────────────────────────────────────────

export class AiVisionService {
  private client: OpenAI;
  private model: string;

  constructor(options?: {
    apiKey?: string;
    baseURL?: string;
    model?: string;
  }) {
    const apiKey = options?.apiKey || process.env.DASHSCOPE_API_KEY;
    if (!apiKey) throw new Error('DASHSCOPE_API_KEY 未设置');

    this.client = new OpenAI({
      apiKey,
      baseURL: options?.baseURL || DEFAULT_BASE_URL,
    });
    this.model = options?.model || DEFAULT_MODEL;
  }

  /** 单图识别 */
  async recognize(
    imageInput: string,
    promptOrTemplateId = 'general',
    model?: string,
  ): Promise<string> {
    // 如果传的是模板 ID，查找并使用模板的 prompt 和 model
    const template = getPromptTemplate(promptOrTemplateId);
    const prompt = template?.prompt || promptOrTemplateId;
    const effectiveModel = model || template?.model || this.model;

    const imageUrl = imageInput.startsWith('http') || imageInput.startsWith('data:')
      ? imageInput
      : this.imageToBase64(imageInput);

    const completion = await this.client.chat.completions.create({
      model: effectiveModel,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: imageUrl } },
            { type: 'text', text: prompt },
          ],
        },
      ],
    });

    return completion.choices[0]?.message?.content || '';
  }

  /** 多图对比分析 */
  async compare(
    imageInputs: string[],
    promptOrTemplateId = 'compare-products',
    model?: string,
  ): Promise<string> {
    const template = getPromptTemplate(promptOrTemplateId);
    const prompt = template?.prompt || promptOrTemplateId;
    const effectiveModel = model || template?.model || QWEN_VL_MODELS.max;

    const content = await Promise.all(
      imageInputs.map(async (img) => ({
        type: 'image_url' as const,
        image_url: {
          url: img.startsWith('http') || img.startsWith('data:') ? img : this.imageToBase64(img),
        },
      })),
    );

    content.push({ type: 'text', text: prompt });

    const completion = await this.client.chat.completions.create({
      model: effectiveModel,
      messages: [{ role: 'user', content }],
    });

    return completion.choices[0]?.message?.content || '';
  }

  // ─── 工具方法 ─────────────────────────────────────────────

  private imageToBase64(imagePath: string): string {
    const absolutePath = path.resolve(imagePath);
    if (!fs.existsSync(absolutePath)) {
      throw new Error(`文件不存在: ${absolutePath}`);
    }
    const buffer = fs.readFileSync(absolutePath);
    const ext = path.extname(absolutePath).slice(1) || 'png';
    return `data:image/${ext};base64,${buffer.toString('base64')}`;
  }
}
