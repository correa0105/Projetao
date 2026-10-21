# Cadastro e recuperação de senha

## Ouro inicial durante o beta

Novas contas são inscritas automaticamente na coorte open-beta-20261021 quando
beta_registration_settings.enabled está ativo. Elas recebem 6.000 PO (600.000 CP)
uma única vez, no primeiro personagem, pelo mecanismo transacional já existente
grantBetaStartingGold. O registro permanece após excluir o personagem e impede
repetição. Não há crédito por novo personagem, login ou redefinição de senha.
Migration 122 cria a inscrição e muda o default de novos registros beta; contas,
saldos e concessões anteriores são preservados. Instalação começa desativada para
não ativar beta em ambientes de teste; publicação na Hostinger ativa explicitamente.
Desligar futuras inscrições não retira ouro nem apaga histórico. --beta-gold cobre
concorrência, valor exato, segundo personagem, exclusão/recriação, contas antigas
e desativação, em banco descartável.

Novas senhas exigem pelo menos seis caracteres, com letra maiúscula, minúscula
e número; limite superior continua 128. Letras acentuadas também são aceitas.
Regra única em shared/password-policy.ts, escrita junto ao campo do cadastro e
da nova senha, com validação nativa e no servidor. Login não reaplica a política
a senhas existentes e nenhuma conta/senha antiga é reescrita.

Esqueci minha senha solicita o e-mail e usa Better Auth para gerar link de uso
único válido por 30 minutos. Callback retorna sempre à origem canônica do site,
na página leve `/?recover=1`, que não espera as imagens dos cenários. Token é
retirado da barra de endereço após a montagem. Nova senha exige confirmação;
sucesso revoga sessões antigas. Pedidos para e-mails desconhecidos respondem da
mesma forma que conhecidos. Limites de 3 pedidos/minuto e 5 redefinições/minuto
por IP, além dos demais controles de autenticação e origem.

Remetente inicial é o Gmail da própria conta de administrador, por pedido do
usuário. Menu do avatar → Recuperação por e-mail permite informar a senha de
aplicativo do Google, verificar a conexão antes de salvar e enviar teste somente
ao próprio administrador. Nenhuma credencial é pedida pelo chat. Endereço vem
da sessão autenticada; cliente não escolhe remetente nem destinatário do teste.
Jogadores e preview básico recebem 403 na configuração.

SMTP smtp.gmail.com:465 com TLS, certificados validados, timeouts e logs de
protocolo desligados. Nodemailer 10.2.0 é a única dependência nova, fixada no lock.
Senha de aplicativo cifrada com AES-256-GCM e chave derivada do segredo privado
de autenticação; API nunca devolve a senha, cifra ou token. Migration 121 só cria
a configuração. Trocar BETTER_AUTH_SECRET exige configurar o envio novamente.

Sem a autorização do Gmail, recuperação devolve indisponibilidade explícita;
não fingir que um e-mail foi enviado. Ativação real depende do usuário concluir
a verificação em duas etapas e criar a senha de aplicativo no Google. Não
automatizar criação/alteração dessa credencial por UI.

O release incremental inclui pacote Nodemailer oficial após conferir SHA-512
com o lock e hashes de todos os arquivos do payload. Manifesto admite somente
essa dependência adicional; pacotes anteriores, public/ e data/ permanecem
iguais à imagem base, com novas migrations numeradas separadas.

# Perícias no celular

SheetChoices mostra em uma coluna quando o espaço real do formulário é menor
que 560 px, mesmo dentro de painel/modal em tela larga. Seleções antigas que
deixaram de estar nas opções filtradas continuam visíveis e podem ser removidas;
não somar uma seleção invisível ao contador. A remoção de uma opção agora
concedida por outra origem permite selecionar outra válida, sem alterar fichas
finalizadas, dados salvos ou a quantidade permitida pela classe.

## Talento de origem

A criação oferece Talento de origem com todos os talentos de origem já suportados,
independente do antecedente. A escolha opcional `backgroundFeat` é validada no JSON
da ficha, alimenta `feats()` e todos os cálculos/recursos existentes. Talento adicional
de Humano continua separado, com prevenção de duplicatas não permitidas. Escolhas
de magias, perícias, ferramentas e instrumentos acompanham o talento escolhido.
Trocar antecedente conserva a escolha explícita. Fichas antigas sem a nova chave
conservam o talento e a escolha de classe mágica anteriores; nenhuma ficha finalizada
é reescrita. Matriz de 72 combinações espécie/classe/talento, efeitos de Robusto/Alerta,
rejeição de talento inventado e persistência pela API/UI cobertos nos testes.

Teste em banco local UUID descartável:
`node scripts/test-portal-controls-isolated.mjs --account-access` intercepta SMTP
apenas no processo de teste. Verifica senha de seis caracteres, recusas da API,
texto do cadastro, autorização da configuração, segredo cifrado/nunca devolvido,
resposta genérica, rate limit, link canônico, confirmação, uso único/expiração,
revogação de sessões e perícia antiga visível/removível no celular. Capturas em
test-results/account-access. Nenhum e-mail real é enviado nesse teste.

## Remoção de atalhos do VTT

Uma referência antiga a personagem/arma/magia que deixou a mesa não pode bloquear
a edição da barra inteira. Salvamento valida referências novas; atalhos existentes
podem ser mantidos, movidos ou removidos. Execução continua validando permissões e
recursos atuais, sem acesso a fichas externas à mesa. Dono da mesa é mestre mesmo
sem administrador. Abas trancadas e revisões concorrentes permanecem protegidas.
Interface fecha o detalhe do atalho somente depois de confirmar o salvamento.
`--shortcuts` reproduz referência antiga mais ataque de monstro, remove ambos pela
interface, recarrega e verifica persistência; novas referências inválidas e edição
de aba trancada continuam recusadas.
