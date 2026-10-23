const COMMON = ["password","12345678","123456789","qwerty","111111","abc123","iloveyou","tianxi","admin"];

export function passwordStrength(pw: string) {
  const checks = [
    { ok: pw.length >= 8, label: "8 個字元或以上" },
    { ok: /[a-z]/.test(pw) && /[A-Z]/.test(pw), label: "大小寫英文" },
    { ok: /\d/.test(pw), label: "數字" },
    { ok: /[^A-Za-z0-9]/.test(pw), label: "符號" },
  ];
  const common = COMMON.some((c) => pw.toLowerCase().includes(c)) || /^(.)\1+$/.test(pw);
  let score = checks.filter((c) => c.ok).length + (pw.length >= 14 ? 1 : 0);
  if (pw.length < 8 || common) score = Math.min(score, 1);
  const levels = ["太弱", "弱", "一般", "良好", "強", "非常強"];
  return { score, label: levels[score], checks, common };
}
