
# Controle AITe - Guia de Auditoria e Integração

## ⚠️ CORREÇÃO DE ERRO COMUM (FIREBASE RULES)

Se você viu um erro de `Unexpected '{'` na aba **Regras (Rules)** do Firebase, é porque você tentou colar código JavaScript lá. 

### O que fazer na aba Regras:
Apague tudo e cole apenas isto:
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

### Onde colocar o seu código de configuração:
O código que contém `apiKey`, `projectId` e os `import { initializeApp }` deve ficar dentro do seu arquivo **App.tsx**, logo no início.

---

## 🚀 Estrutura do Banco Cloud Firestore

Para que o sistema funcione 100%, seu banco deve seguir esta hierarquia automática:

- **Coleção `turnos`**: Documentos criados a cada início de jornada.
  - Campos: `userId`, `userName`, `startTime`, `metrics`, `sessions`.
  - O campo `sessions` é um array que registra cada entrada e saída do app monitorado.

## 🛠️ Detalhes da Telemetria
O aplicativo utiliza uma trava lógica de **1.5 segundos** para evitar contagens duplicadas causadas por oscilações do sistema Android (o erro de "marcar 3 acessos quando abriu apenas 2"). 

Sessões de uso menores que **2 segundos** são descartadas automaticamente por serem consideradas "ruídos" ou aberturas acidentais.
