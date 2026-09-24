async function render() {
  const pending = await chrome.storage.session.get(null);
  const { origins = [] } = await chrome.permissions.getAll();
  const status = document.getElementById('status');
  for (const [id, values] of [['pending', Object.keys(pending).filter(origin => !origins.includes(origin))], ['granted', origins]]) {
    const container = document.getElementById(id); container.replaceChildren();
    if (!values.length) container.textContent = 'Nenhum servidor.';
    for (const origin of values) {
      const row = document.createElement('div'); row.className = 'server';
      const label = document.createElement('code'); label.textContent = origin;
      const button = document.createElement('button'); button.textContent = id === 'pending' ? 'Autorizar este servidor' : 'Remover acesso';
      button.onclick = async () => {
        try {
          const granted = id === 'pending' ? await chrome.permissions.request({ origins: [origin] }) : await chrome.permissions.remove({ origins: [origin] });
          if (granted) await chrome.storage.session.remove(origin);
          status.textContent = granted ? 'Atualizado. Recarregue o DuckFlix para testar.' : 'Permissão não concedida.';
          await chrome.action.setBadgeText({ text: '' }); await render();
        } catch (error) { status.textContent = error.message; }
      };
      row.append(label, button); container.append(row);
    }
  }
}
render();
