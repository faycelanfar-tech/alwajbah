@echo off
chcp 65001 >nul
title Alwajbah School System
powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "%~dp0server.ps1"
