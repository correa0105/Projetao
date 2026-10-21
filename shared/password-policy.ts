export const passwordMinimumLength = 6;
export const passwordMaximumLength = 128;
export const passwordRule =
  'Use pelo menos 6 caracteres, com uma letra maiúscula, uma minúscula e um número.';
export const passwordPattern = '(?=.*\\p{Ll})(?=.*\\p{Lu})(?=.*[0-9]).{6,128}';
export function validNewPassword(value: string) {
  return (
    value.length >= passwordMinimumLength &&
    value.length <= passwordMaximumLength &&
    /\p{Ll}/u.test(value) &&
    /\p{Lu}/u.test(value) &&
    /[0-9]/.test(value)
  );
}
