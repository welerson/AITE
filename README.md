
# Controle AITe - Guia de Auditoria e Teste

Este aplicativo simula um sistema de telemetria Android para auditoria de produtividade e conformidade na fiscalização de trânsito.

## 1. Funcionamento Automático (Diferencial)
Diferente de sistemas manuais, este app foi projetado para ser **passivo**:
- **Sem Intervenção**: O agente não precisa clicar em botões toda vez que for multar.
- **Background Listener**: O app utiliza APIs de acessibilidade ou estatísticas de uso do Android para detectar quando o pacote `br.gov.exemplo.aite` entra em primeiro plano.
- **Coleta Invisível**: O tempo de uso é cronometrado de forma transparente, garantindo que o dado seja fidedigno à realidade operacional.

## 2. Permissões Requeridas no Android Real
Para que a automação funcione em um dispositivo físico:
- **`android.permission.PACKAGE_USAGE_STATS`**: Essencial para o app "saber" quais outros apps estão sendo abertos.
- **Exclusão de Otimização de Bateria**: Necessário para que o Android não "mate" o processo de auditoria durante o dia.

## 3. Heurísticas de Auditoria (Cruzamento de Dados)
O sistema compara o que o agente **declarou** com o que o sistema **detectou**:
- **Inconsistência de Tempo**: Declarar 10 multas tendo usado o app AITe por apenas 1 minuto (lavratura manual/bloco papel sendo passada para o digital em lote).
- **Falta de Telemetria**: Declarar multas sem que o sistema tenha detectado a abertura do app AITe (uso de dispositivos de terceiros ou fraude).

## 4. Como Testar esta Simulação
1. Inicie como **Agente**.
2. Clique em **Começar Agora**.
3. **Observe a Tela**: O sistema irá detectar automaticamente períodos de uso (simulando a troca de apps pelo agente). Os números de "Tempo" e "Acessos" subirão sem você clicar em nada.
4. Finalize o expediente e insira um número alto de multas (ex: 50) para ver o sistema gerar alertas de inconsistência no painel do gestor.
