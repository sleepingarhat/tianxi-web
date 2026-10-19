import { expect, it } from 'vitest';
import { racingClassLabel } from './racing-class';
it('官方中文班次不被刪成問號', () => {
  expect(racingClassLabel('第五班')).toBe('第五班');
  expect(racingClassLabel('第三班')).toBe('第三班');
});
it('數字及英文班次格式化而分級賽保留原標籤', () => {
  expect(racingClassLabel(5)).toBe('第5班');
  expect(racingClassLabel('Class 4')).toBe('第4班');
  expect(racingClassLabel('G2')).toBe('G2');
  expect(racingClassLabel(null)).toBe('班次未提供');
});