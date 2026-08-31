# ─── STAGE 1: BUILD (Compilazione Angular) ─────────────────────────────────────

# Node.js su Alpine Linux (immagine estremamente leggera, ~5 MB)
# "AS builder" assegna un nome a questa fase, utile per copiare i file nello stage successivo
FROM node:18-alpine AS builder
WORKDIR /app

# Copia prima solo i file delle dipendenze: Sfrutta la cache Docker
# se il codice cambia ma le librerie no, questo layer non viene rieseguito
COPY package.json package-lock.json ./

# npm ci (Clean Install): Installa le versioni esatte definite in package-lock.json
# Più rigoroso e riproducibile di npm install
RUN npm ci

# Copia il resto del codice sorgente Angular
COPY . .

# Compilazione di produzione: Angular trasforma TypeScript in file statici ottimizzati (HTML, CSS, JS minificati)
RUN npm run build -- --configuration production



# ─── STAGE 2: SERVE (Nginx) ────────────────────────────────────────────────────
# Nuovo stage pulito: solo Nginx (niente Node.js, niente node_modules)
# Immagine leggera e adatta a servire file statici
FROM nginx:alpine

# Rimuove la pagina di default di Nginx
RUN rm -rf /usr/share/nginx/html/*

# Copia SOLO i file compilati dallo stage "builder"
# Tutto il resto (sorgenti, node_modules, strumenti di build) viene scartato
COPY --from=builder /app/dist/gestore-documenti-smart-frontend/browser /usr/share/nginx/html

# Configurazione Nginx personalizzata
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Porta HTTP standard
EXPOSE 80

# "daemon off" tiene Nginx in primo piano (PID 1)
# Senza, Nginx andrebbe in background e Docker spegnerebbe il container
CMD ["nginx", "-g", "daemon off;"]
