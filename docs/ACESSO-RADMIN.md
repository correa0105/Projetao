# Acesso pelo Radmin VPN

O Compose mantém `localhost:3000` e permite publicar a mesma porta em uma segunda interface, escolhida no `.env` local:

```dotenv
APP_NETWORK_IP=IP_DO_SERVIDOR_NO_RADMIN
APP_ORIGIN=http://localhost:3000,http://IP_DO_SERVIDOR_NO_RADMIN:3000
```

Substitua os exemplos pelo IPv4 exibido no Radmin do computador que hospeda o Docker. Preserve quaisquer origens já configuradas, separadas por vírgula. Não altere as senhas nem `BETTER_AUTH_SECRET`.

Recrie somente o serviço `app`, usando os mesmos arquivos Compose da versão instalada, para aplicar ambiente e portas. Quando `APP_NETWORK_IP` estiver ausente ou for `127.0.0.1`, o Compose normaliza as duas entradas em uma única publicação local.

No outro computador, conectado à mesma rede Radmin, abra `http://IP_DO_SERVIDOR_NO_RADMIN:3000`. `localhost` nesse computador aponta para ele próprio. O endereço precisa estar em `APP_ORIGIN` para que login e ações autenticadas sejam aceitos.

Se a página nem abrir, verificar conexão Radmin, publicação da porta e regra do firewall para o backend do Docker. Se abrir, mas o login retornar erro de origem, conferir o endereço completo em `APP_ORIGIN`, incluindo protocolo e porta. A autenticação permanece obrigatória.

Em 20/10/2026, acesso local e pelo IP Radmin retornaram HTTP 200; o usuário confirmou a abertura no outro computador. A alteração não exige rebuild da imagem nem migration.
