
# 🛡️ Guia de Implementação Nativa (Android)

Para que este aplicativo web monitore o app **AITe** sem intervenção do agente, você deve implementar um `AccessibilityService` no seu projeto Android Studio.

## 1. O que o Android deve fazer:
O serviço nativo deve monitorar eventos do tipo `TYPE_WINDOW_STATE_CHANGED`. Sempre que o pacote `br.gov.aite` entrar no foco, o Android deve chamar uma função JavaScript no WebView.

## 2. Exemplo de Código Nativo (Kotlin):
```kotlin
override fun onAccessibilityEvent(event: AccessibilityEvent) {
    val packageName = event.packageName?.toString()
    val isAite = packageName == "br.gov.aite"
    
    // Dispara o evento para o WebView
    webView.evaluateJavascript("""
        window.dispatchEvent(new CustomEvent('android_foreground_event', { 
            detail: { 
                packageName: 'br.gov.aite', 
                isForeground: $isAite 
            } 
        }));
    """, null)
}
```

## 3. Segurança Inviolável:
*   **Sem Botões**: O Agente não consegue "clicar" para entrar no AITe. O registro só acontece se o sistema operacional detectar a janela aberta.
*   **Debounce de 1.5s**: Evita que o agente fique "trocando de tela" rápido para gerar muitos acessos falsos.
*   **Filtro de 2s**: Se o agente abrir o app e fechar imediatamente (menos de 2 segundos), o sistema descarta a sessão, pois não houve tempo para lavrar uma multa real.

---

### Configuração do Cloud Firestore (Regras)
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true; // Em produção, restrinja por auth.uid
    }
  }
}
```
