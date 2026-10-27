# Retrato e token completos antes de publicar — 26/10/2026

O OBruxo (Orc ativo) apareceu frontal no VTT porque a criação havia publicado o retrato no checkpoint, antes do token. O token falhou na revisão por câmera inclinada e barras da calça. Sem `character_tokens`, o importador recorreu à arte frontal.

O checkpoint de `completeArt` passa a guardar somente `approved_portrait`, privado. Criação/personagem, ficha, ouro inicial, arte e token entram juntos depois que o par termina. Se o token falhar, a criação continua recuperável no slot e o retrato aprovado é reutilizado. Substituições permanecem privadas até a escolha do dono entre manter/aceitar o par. Criações legadas parcialmente publicadas são concluídas no mesmo personagem, sem novo slot ou cobrança extra.

Revisão do token exige `top_down_correct=true` separado de aprovação/anatomia/roupa; falso ou ausente reprova. As instruções distinguem identidade frontal de câmera superior e exigem reconstruir a projeção quando a câmera estiver errada, preservando oclusão natural. Sem relaxar os demais critérios.

Recuperação do OBruxo no pedido original `81a6a968-1a75-45bf-9447-8b217d77086e`: aprovado na terceira revisão, token entregue e mesma peça da mesa sincronizada para `/top-down`. Personagem `19272d4b-18b8-4360-b307-fb058fbbe0e8`, revisão 1 → 2. Retrato permanece idêntico por MD5 `4d9aa14db26eedd75f65a65abd347081`; nenhum novo job ou personagem. O homônimo humano excluído foi conservado. Backup anterior `/opt/alvorada/backups/bruxo-token-recovery-before-20261026.dump`; PNGs e verificação privados em `.local/bruxo-*`.

Testes: API real com seis atributos do slot, checkpoint sem personagem/ouro, token inválido/falha/retry, par completo, substituição privada, aceitação e recuperação legada; teste de ouro inicial atualizado. Três testes aprovados. Sete testes de prompts/token validam também recusa de câmera falsa/ausente, mantendo transparência, referências e reparos. TypeScript aprovado. Sem migration de arte. Recarregar ilustrador somente com filas ociosas, sob trava; preservar trabalhos ativos.
