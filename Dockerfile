FROM node:20-alpine

WORKDIR /app

# Copiar archivos de dependencias
COPY package*.json ./

# Instalar todas las dependencias
RUN npm install

# Copiar el resto del código del proyecto
COPY . .

# Exponer el puerto de la API REST
EXPOSE 3000

# Iniciar la aplicación en modo desarrollo (recarga en caliente con ts-node-dev)
CMD ["npm", "run", "dev"]
