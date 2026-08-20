# Stage 1 - Build: Compilazione del progetto Angular
FROM node:18-alpine AS builder
WORKDIR /app

# Copia prima solo i file delle dipendenze (sfrutta la cache Docker)
COPY package.json package-lock.json ./
# Installa le dipendenze Node
RUN npm ci

# Copia i sorgenti Angular
COPY . .
# Build di produzione
RUN npm run build -- --configuration production



# Stage 2 - Serve: Web server leggero con Nginx
FROM nginx:alpine

# Rimuovi la config Nginx di default
RUN rm -rf /usr/share/nginx/html/*

# Copia i file compilati da Stage 1
# Il nome della cartella dist dipende dal nome del tuo progetto Angular
COPY --from=builder /app/dist/gestore-documenti-smart-frontend/browser /usr/share/nginx/html

# Copia la configurazione Nginx personalizzata
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Esponi la porta 80
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
