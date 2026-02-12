fetch('https://yd0iaumhk3.execute-api.eu-west-1.amazonaws.com/dev-test-1')
    .then(response => {

      if (!response.ok){
        throw new Error('HTTP error ' + response.status)
      }

      return response.json();
    })
    .then(data => {
      
      const notesDiv = document.getElementById('notes');
      notesDiv.innerHTML = "";

      data.notes.forEach(note =>{
        const card = document.createElement('div');

        card.innerHTML = `
        <h3>${note.name}</h3>
        <p><strong>Creator: </strong> ${note.creator}</p>
        <pre>${note.content}</pre>
        <hr/>`;

        notesDiv.appendChild(card);
      })
    })
    .catch(error =>{
      console.error('Failed to load JSON:', error)
    });