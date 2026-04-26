@echo off
chcp 65001 >nul
title CloudStreamWeb

:: Check if Node.js is installed
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo ============================================
    echo  Node.js nao encontrado!
    echo  Baixe em: https://nodejs.org/
    echo  Instale e execute este script novamente.
    echo ============================================
    pause
    exit /b 1
)

echo ============================================
echo  CloudStreamWeb
echo ============================================
echo.

:: Check if dependencies are installed
if not exist "node_modules" (
    echo [1/2] Instalando dependencias...
    echo.
    call npm install
    if %errorlevel% neq 0 (
        echo.
        echo Erro ao instalar dependencias!
        pause
        exit /b 1
    )
    echo.
    echo Dependencias instaladas com sucesso!
    echo.
)

echo Iniciando...
echo.
echo  Abrindo em: http://localhost:5173
echo.
echo  Pressione Ctrl+C para parar.
echo ============================================
echo.

start http://localhost:5173
npm run dev
