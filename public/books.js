document.addEventListener('DOMContentLoaded', () => {
    const bookContainer = document.querySelector('.row');
    const searchInput = document.querySelector('.search-input');
    const loadingSpinner = createLoadingSpinner();

    // Notion API base configuration
    const notionBaseUrl = '/api/notion'; // Backend endpoint to interact with Notion

    // Create and return loading spinner element
    function createLoadingSpinner() {
        const spinner = document.createElement('div');
        spinner.className = 'd-flex justify-content-center my-5';
        spinner.innerHTML = `
            <div class="spinner-border text-primary" role="status">
                <span class="visually-hidden">Loading...</span>
            </div>
        `;
        return spinner;
    }

    // Create HTML for a single book card
    function createBookCard(book) {
        const currentPageText = `Current Page: ${book.currentPage || 'N/A'}`;
        return `
            <div class="col-md-6 col-lg-4">
                <div class="card book-card" data-book-id="${book.name}">
                    <img src="${"/thumbnails/" + book.name + '.png'|| '/api/placeholder/400/300'}" class="book-cover" alt="${book.name}">
                    <div class="card-body">
                        <h5 class="card-title">${book.name}</h5>
                        <p class="card-text text-muted mb-2">${currentPageText}</p>
                        <div class="d-flex justify-content-between align-items-center mb-2">
                            <span class="badge bg-secondary">${book.pages} pages</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    // Display books in the container
    async function displayBooks(books) {
        bookContainer.innerHTML = books.map(book => createBookCard(book)).join('');

        // Add click event listeners to all book cards
        document.querySelectorAll('.book-card').forEach(card => {
            card.addEventListener('click', () => {
                const bookId = card.dataset.bookId;
                window.location.href = `add-book?bookId=${bookId}`;
            });
        });
    }

    // Fetch books from the backend
    async function fetchBooks(query = '') {
        const url = `${notionBaseUrl}/books${query ? `?q=${encodeURIComponent(query)}` : ''}`;
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error('Failed to fetch books from the Notion database.');
        }

        return response.json();
    }

    // Load books when page loads
    async function loadBooks(query = '') {
        bookContainer.innerHTML = '';
        bookContainer.appendChild(loadingSpinner);

        try {
            const books = await fetchBooks(query);
            displayBooks(books);
        } catch (error) {
            console.log(error)
            bookContainer.innerHTML = `
                <div class="alert alert-danger" role="alert">
                    Error loading books. Please try again later.
                </div>
            `;
        }
    }

    // Handle search input
    let searchTimeout;
    searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            const query = e.target.value.trim();
            loadBooks(query);
        }, 300);
    });

    // Load books on page load
    loadBooks();
});
