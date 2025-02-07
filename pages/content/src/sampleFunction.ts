export function sampleFunction() {
  console.log('content script - sampleFunction() called from another module');
}

function handleKeyDown(event: Event) {
  const keyEvent = event as KeyboardEvent;
  console.log('triggered');
  console.log(document.activeElement);
  // Verifica si la tecla es Enter o Tab
  // Detectar Ctrl + H
  if (!(keyEvent.ctrlKey && keyEvent.key === 'h')) return;
  console.log('key pressed');
  const el = document.activeElement;
  if (!el) return;
  console.log('element');
  // Detectar si es un input/textarea
  let textValue = '';
  let isContentEditable = false;

  console.log(el);
  // Evitamos que Tab mueva el foco o que Enter envíe el mensaje
  keyEvent.preventDefault();
  keyEvent.stopPropagation();

  if (el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && (el as HTMLInputElement).type === 'text')) {
    textValue = (el as HTMLTextAreaElement | HTMLInputElement).value.trim();
  } else if ((el as HTMLElement).isContentEditable) {
    console.log('is editable');
    isContentEditable = true;
    textValue = (el as HTMLElement).innerText.trim();
  } else {
    console.log('is NOT editable');
    // No es un campo de texto "tradicional"
    return;
  }
  console.log(textValue);
  // Verifica si comienza con "/helpme"
  if (textValue.startsWith('/helpme')) {
    keyEvent.preventDefault(); // Evita que el textarea inserte un salto de línea o pierda foco

    // Parsea el prompt después de "/helpme"
    const prompt = textValue.replace(/^\/helpme\s*/, '');

    // Llama a tu IA; por ejemplo, con fetch a la API de OpenAI (puedes meter esto en una función aparte)
    fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer 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`, // si hace falta
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo-0125',
        messages: [{ role: 'user', content: prompt }],
      }),
    })
      .then(res => res.json())
      .then(data => {
        console.log('data');
        console.log(data.choices[0]?.message?.content);
        const response = data.choices[0]?.message?.content || ':(';

        // Selecciona el contenido del input
        const range = document.createRange();
        range.selectNodeContents(el);
        const sel = window.getSelection();
        if (sel) {
          sel.removeAllRanges();
          sel.addRange(range);

          // Borra el contenido actual
          document.execCommand('delete');

          // Inserta el nuevo texto como si fuera escrito por el usuario
          document.execCommand('insertText', false, response);
        }
      })
      .catch(err => {
        console.error(err);
        if (isContentEditable) {
          (el as HTMLElement).innerText = 'Error llamando a la IA';
        } else {
          (el as HTMLTextAreaElement | HTMLInputElement).value = 'Error llamando a la IA';
        }
      });
  }
}

setTimeout(() => {
  document.removeEventListener('keydown', handleKeyDown);

  function attachListenerToDocument(doc: Document | ShadowRoot) {
    try {
      doc.removeEventListener('keydown', handleKeyDown);
      doc.addEventListener('keydown', handleKeyDown, true); // Using capture phase
    } catch (e) {
      console.log('Could not attach listener to document:', e);
    }
  }

  function addListenerToIframes(root: Document | HTMLElement | ShadowRoot = document) {
    // Add listener to current document/shadow root
    if (root instanceof Document || root instanceof ShadowRoot) {
      attachListenerToDocument(root);
    }

    // Handle shadow DOM
    if (root instanceof HTMLElement && root.shadowRoot) {
      attachListenerToDocument(root.shadowRoot);
      addListenerToIframes(root.shadowRoot);
    }

    // Find all elements that might have shadow roots
    const allElements =
      root instanceof ShadowRoot || root instanceof Document
        ? root.querySelectorAll('*')
        : root.getElementsByTagName('*');

    Array.from(allElements).forEach(element => {
      if (element.shadowRoot) {
        attachListenerToDocument(element.shadowRoot);
        addListenerToIframes(element.shadowRoot);
      }
    });

    // Handle iframes
    const iframes =
      root instanceof ShadowRoot || root instanceof Document
        ? root.querySelectorAll('iframe')
        : root.getElementsByTagName('iframe');

    Array.from(iframes).forEach(iframe => {
      try {
        if (iframe.contentDocument) {
          attachListenerToDocument(iframe.contentDocument);
          addListenerToIframes(iframe.contentDocument);
        }

        iframe.addEventListener('load', () => {
          if (iframe.contentDocument) {
            attachListenerToDocument(iframe.contentDocument);
            addListenerToIframes(iframe.contentDocument);
          }
        });
      } catch (e) {
        console.log('Could not add listener to iframe:', e);
      }
    });
  }

  // Initial setup
  addListenerToIframes();

  // Watch for dynamically added elements and shadow roots
  const observer = new MutationObserver(mutations => {
    mutations.forEach(mutation => {
      mutation.addedNodes.forEach(node => {
        if (node instanceof HTMLElement) {
          addListenerToIframes(node);
        }
      });
    });
  });

  // Observe the entire document for changes
  observer.observe(document, {
    childList: true,
    subtree: true,
  });

  // Periodically check for new elements
  const checkInterval = setInterval(() => {
    addListenerToIframes();
  }, 2000);

  // Cleanup function
  window.addEventListener('unload', () => {
    clearInterval(checkInterval);
    observer.disconnect();
  });
}, 1000);
