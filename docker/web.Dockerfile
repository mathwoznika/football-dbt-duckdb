# Front em duas etapas: node so para compilar, nginx para servir.
#
# Sem isso a imagem final carregaria node_modules inteiro — centenas de MB para
# entregar arquivos estaticos que somam menos de 400 KB.
FROM node:22-alpine AS compilacao
WORKDIR /app

# O Vite le variaveis VITE_* em tempo de COMPILACAO e as embute no bundle.
# Por isso o endereco da API precisa chegar aqui como build arg: definir a
# variavel no container que serve, depois, nao teria efeito nenhum.
ARG VITE_API_BASE=/api
ENV VITE_API_BASE=$VITE_API_BASE

COPY web/package*.json ./
RUN npm ci
COPY web/ ./
RUN npm run build

FROM nginx:alpine
COPY --from=compilacao /app/dist /usr/share/nginx/html
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
