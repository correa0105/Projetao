# Ken Kaneki — troca pontual de talento, 25/10/2026

Por pedido explícito do proprietário do projeto, a ficha única e ativa Ken Kaneki recebeu Robusto no lugar de Atacante Selvagem. A seleção estava em options.humanFeat, talento extra de Humano; backgroundFeat=Alerta permaneceu. Não alterar o antecedente nem aplicar a troca a outra ficha.

Validação local com validateChoices, feats e deriveSheet, usando snapshot privado: Humano/Monge nível 1, máximo 9 antes e 11 depois. PV atuais estavam completos (9), passando a 11, mantendo o mesmo déficit zero; o script conserva zero e null quando presentes, sem ressuscitar ou resetar recursos. Nenhum token importado desse personagem existia no VTT no momento da correção.

Aplicação transacional com FOR UPDATE da ficha e do personagem, amarrada ao ID/dono exatos e à seleção anterior. Somente choices.options.humanFeat, character_sheets.current_hp, characters.hp e updated_at da ficha foram alterados. Comparação integral das demais colunas/JSON comprovou preservação de Alerta, atributos, dados/atribuição, classe/nível, escolhas, ouro, equipamento, recursos, notas e arte. Script idempotente não reaplica PV se o talento já tiver sido trocado.

Snapshots privados antes da operação e da linha efetivamente bloqueada em /opt/alvorada/backups/ken-kaneki-feat-before-20261025.json e ken-kaneki-feat-fresh-before-20261025.json, ambos com permissão 600. Script e preview privados em .local/ken-kaneki-feat-20261025/. Nenhum dado privado completo ou identificador de conta foi incorporado ao Git. Leitura posterior confirmou Robusto, Alerta e 11/11 PV. Sem novo endpoint, schema, migration, deploy ou regeneração de imagem.
