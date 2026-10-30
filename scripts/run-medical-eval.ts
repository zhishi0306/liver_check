#!/usr/bin/env node
/**
 * Simple Evaluation Runner - 简单的评估测试运行器
 * 
 * 直接运行医学用药安全测试，验证系统功能
 */

console.log('========================================');
console.log('用药安全智能Agent - 评估测试');
console.log('========================================\n');

// 导入评估工具
import { evaluationTools } from '../medical-harness/evaluation_runner.ts';

// 运行测试
const result = await evaluationTools[0].handler({
  test_ids: ['DDI-001', 'DDI-002', 'DDI-003'],
  verbose: true
});

console.log('\n========================================');
console.log('测试结果:', JSON.stringify(result, null, 2));