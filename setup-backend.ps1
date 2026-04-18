# Script PowerShell para configuração e execução do backend com Prisma
# Este script verifica dependências, instala se necessário e executa migrações.

# Função para escrever mensagens coloridas
function Write-ColorMessage {
    param (
        [string]$Message,
        [string]$Color = "White"
    )
    Write-Host $Message -ForegroundColor $Color
}

# Verificar se está na pasta correta (apps/backend)
$currentPath = Get-Location
$expectedPath = Join-Path $PSScriptRoot "apps\backend"

if ($currentPath.Path -ne $expectedPath) {
    Write-ColorMessage "Não está na pasta correta. Navegando para apps/backend..." "Yellow"
    try {
        Set-Location $expectedPath
        Write-ColorMessage "Navegação realizada com sucesso." "Green"
    } catch {
        Write-ColorMessage "Erro ao navegar para apps/backend: $($_.Exception.Message)" "Red"
        exit 1
    }
} else {
    Write-ColorMessage "Já está na pasta correta: apps/backend." "Green"
}

# Verificar se schema.prisma existe em ./src/prisma/ (Prisma 7 + prisma.config.ts)
$schemaPath = ".\src\prisma\schema.prisma"
if (Test-Path $schemaPath) {
    Write-ColorMessage "schema.prisma encontrado em ./src/prisma/." "Green"
} else {
    Write-ColorMessage "schema.prisma não encontrado. Criando arquivo básico..." "Yellow"
    try {
        # Criar diretório se não existir
        if (!(Test-Path ".\src\prisma")) {
            New-Item -ItemType Directory -Path ".\src\prisma" -Force
        }
        # Schema mínimo: URL do banco fica em prisma.config.ts (Prisma 7)
        $schemaContent = @"
// This is your Prisma schema file,
// learn more about it in the docs: https://pris.ly/d/prisma-schema

datasource db {
  provider = "postgresql"
}

generator client {
  provider = "prisma-client-js"
}

model Example {
  id    Int     @id @default(autoincrement())
  email String  @unique
  name  String?
}
"@
        $schemaContent | Out-File -FilePath $schemaPath -Encoding UTF8
        Write-ColorMessage "schema.prisma criado com sucesso." "Green"
    } catch {
        Write-ColorMessage "Erro ao criar schema.prisma: $($_.Exception.Message)" "Red"
        exit 1
    }
}

# Verificar se .env existe na raiz do projeto (sobe 2 níveis)
$envPath = "..\..\.env"
if (Test-Path $envPath) {
    Write-ColorMessage ".env encontrado na raiz do projeto." "Green"
} else {
    Write-ColorMessage ".env não encontrado. Copiando de .env.example se existir..." "Yellow"
    try {
        $exampleEnvPath = "..\..\.env.example"
        if (Test-Path $exampleEnvPath) {
            Copy-Item $exampleEnvPath $envPath
            Write-ColorMessage ".env copiado de .env.example." "Green"
        } else {
            # Criar .env básico
            $envContent = "DATABASE_URL=\"postgresql://username:password@localhost:5432/mydb?schema=public\"\n"
            $envContent | Out-File -FilePath $envPath -Encoding UTF8
            Write-ColorMessage ".env criado com configuração básica. Ajuste as variáveis conforme necessário." "Yellow"
        }
    } catch {
        Write-ColorMessage "Erro ao criar/copiar .env: $($_.Exception.Message)" "Red"
        exit 1
    }
}

# Verificar se node_modules existe
if (Test-Path "node_modules") {
    Write-ColorMessage "node_modules encontrado." "Green"
} else {
    Write-ColorMessage "node_modules não encontrado. Executando npm install..." "Yellow"
    try {
        npm install
        Write-ColorMessage "npm install executado com sucesso." "Green"
    } catch {
        Write-ColorMessage "Erro ao executar npm install: $($_.Exception.Message)" "Red"
        exit 1
    }
}

# Executar npx prisma generate
Write-ColorMessage "Executando npx prisma generate..." "White"
try {
    npx prisma generate
    Write-ColorMessage "npx prisma generate executado com sucesso." "Green"
} catch {
    Write-ColorMessage "Erro ao executar npx prisma generate: $($_.Exception.Message)" "Red"
    exit 1
}

# Seed do usuário admin (opcional)
Write-ColorMessage "Executando npx prisma db seed..." "White"
try {
    npx prisma db seed
    Write-ColorMessage "npx prisma db seed executado com sucesso." "Green"
} catch {
    Write-ColorMessage "Aviso ao executar seed: $($_.Exception.Message)" "Yellow"
}

# Executar npx prisma migrate dev --name init
Write-ColorMessage "Executando npx prisma migrate dev --name init..." "White"
try {
    npx prisma migrate dev --name init
    Write-ColorMessage "npx prisma migrate dev --name init executado com sucesso." "Green"
} catch {
    Write-ColorMessage "Erro ao executar npx prisma migrate dev --name init: $($_.Exception.Message)" "Red"
    exit 1
}

# Relatório final
Write-ColorMessage "\n=== RELATÓRIO FINAL ===" "Cyan"
Write-ColorMessage "- Verificação de pasta: OK" "Green"
Write-ColorMessage "- schema.prisma: OK" "Green"
Write-ColorMessage "- .env: OK" "Green"
Write-ColorMessage "- node_modules: OK" "Green"
Write-ColorMessage "- Prisma generate: OK" "Green"
Write-ColorMessage "- Prisma migrate: OK" "Green"
Write-ColorMessage "Configuração concluída com sucesso!" "Green"