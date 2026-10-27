This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Cronómetro de plaquinhas

Em `/admin`, cria um item do tipo **Contagem regressiva (plaquinhas)**. A data inicial é
**30 de novembro de 2026**. Escolhe o restaurante, nome no painel e duração
do slide, como nos outros conteúdos. Usa **Pré-visualizar cronómetro** para o ver antes
de adicionar à playlist.

O slide mostra **horas totais, minutos e segundos**, como **816:25:09**, sem qualquer
título, legenda, data, mensagem ou indicação de unidade. Dois dias aparecem como
**48:00:00**, sem separar por dias. O relógio habitual da TV e a barra de progresso ficam ocultos
durante este slide. O nome serve apenas para identificar o item no painel.
Indica uma **Hora de saída** provisória e confirma o fuso horário (por defeito,
Londres). Depois podes clicar em **Editar** e atualizar a hora quando receberes o
horário. Se deixares a hora em branco, mostra apenas “--:--:--”. Ao chegar a zero
fica em “00:00:00”, sem mensagem. As alterações chegam à TV
no ciclo normal de atualização, até cerca de 45 segundos.

O visual está disponível em `/countdown`; adapta-se a TVs horizontais e verticais.
Os parâmetros `date`, `time`, `zone`, `title` e `message` no URL guardam as definições.
O item usa o tipo `webpage` já existente na base de dados; não precisa de SQL adicional.
O cronómetro calcula a contagem com o relógio do dispositivo; não faz pedidos de
rede a cada segundo e recupera o tempo correto depois de uma suspensão.

### Funcionamento sem internet

Em produção, `/tv`, `/tv/<restaurante>` e `/countdown?...` preparam um cache local
da página e dos ficheiros estáticos necessários através de `/signage-sw.js`.
A playlist e a rotação do restaurante são guardadas no navegador. Ao reabrir a TV,
a playlist guardada aparece imediatamente, enquanto o sistema tenta atualizar os
dados. Sem ligação, a contagem continua e as mesmas páginas já guardadas podem ser
recarregadas. A configuração de cada cronómetro fica associada ao seu URL completo.
A última página completa só é substituída depois de os ficheiros da nova versão
estarem preparados, para uma ligação interrompida não estragar o cache anterior.

É necessário carregar a página uma vez com internet, no mesmo navegador/dispositivo
que vai ser usado na TV. Aguarda a preparação terminar antes de desligar a rede.
O navegador precisa de suportar Service Workers e permitir armazenamento local.
Funciona em HTTPS e em `http://localhost`/`http://127.0.0.1`; HTTP num IP da rede local
não permite instalar o Service Worker. O cache não é preparado em `npm run dev`.
Para testar localmente, usa `npm run build` e depois `npm start`.

Teste no dispositivo: abre o URL de produção com rede, aguarda cerca de 15 segundos,
desliga a ligação, confirma que os segundos avançam e recarrega o mesmo URL. Para
verificar a preparação sem acrescentar texto à TV, consulta no inspetor o atributo
`data-offline-ready="true"` no elemento `html` de `/tv` e do iframe `/countdown`.
Se a preparação falhar, volta a tentar quando a ligação regressar.

Não limpar os dados/cache do navegador nem ativar limpeza automática ao fechar.
O primeiro acesso sem cache e URLs de ecrãs nunca antes carregados continuam a
precisar de internet. O relógio do dispositivo deve estar correto. Vídeos externos,
TikTok e páginas de outros sites continuam a depender desses serviços; este cache
cobre o cronómetro e a estrutura da TV, não descarrega esses conteúdos.

Para executar os testes de datas, fusos horários, cache e rede indisponível: `npm test`.
Com o servidor de produção local a correr, `node scripts/verify-offline.mjs` valida
o worker contra o HTML, CSS, JavaScript e fontes servidos e simula pedidos sem rede.
Este teste não substitui o teste de recarga no navegador da TV.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.js`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
