        // Simulated database/API response
        const bookDatabase = {
            books: [
                {
                    id: 1,
                    title: "The Great Gatsby",
                    author: "F. Scott Fitzgerald",
                    coverImage: "/api/placeholder/400/300",
                    pages: 180,
                    lastRead: "2024-03-15",
                    genre: "Classic",
                    rating: 4.5
                },
                {
                    id: 2,
                    title: "To Kill a Mockingbird",
                    author: "Harper Lee",
                    coverImage: "/api/placeholder/400/300",
                    pages: 281,
                    lastRead: "2024-03-20",
                    genre: "Classic",
                    rating: 4.8
                },
                {
                    id: 3,
                    title: "1984",
                    author: "George Orwell",
                    coverImage: "/api/placeholder/400/300",
                    pages: 328,
                    lastRead: "2024-03-10",
                    genre: "Science Fiction",
                    rating: 4.6
                },
                {
                    id: 4,
                    title: "Pride and Prejudice",
                    author: "Jane Austen",
                    coverImage: "/api/placeholder/400/300",
                    pages: 432,
                    lastRead: "2024-03-05",
                    genre: "Romance",
                    rating: 4.7
                }
            ],
        
            // Method to get all books
            getAllBooks() {
                return new Promise((resolve) => {
                    setTimeout(() => {
                        resolve(this.books);
                    }, 500); // Simulate network delay
                });
            },
        
            // Method to search books
            searchBooks(query) {
                return new Promise((resolve) => {
                    setTimeout(() => {
                        const filteredBooks = this.books.filter(book => 
                            book.title.toLowerCase().includes(query.toLowerCase()) ||
                            book.author.toLowerCase().includes(query.toLowerCase()) ||
                            book.genre.toLowerCase().includes(query.toLowerCase())
                        );
                        resolve(filteredBooks);
                    }, 300);
                });
            }
        };
        
        // DOM manipulation and event handling
        document.addEventListener('DOMContentLoaded', () => {
            const bookContainer = document.querySelector('.row');
            const searchInput = document.querySelector('.search-input');
            const loadingSpinner = createLoadingSpinner();
        
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
                const date = new Date(book.lastRead).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                });
        
                return `
                    <div class="col-md-6 col-lg-4">
                        <div class="card book-card" data-book-id="${book.id}">
                            <img src="${book.coverImage}" class="book-cover" alt="${book.title}">
                            <div class="card-body">
                                <h5 class="card-title">${book.title}</h5>
                                <p class="card-text text-muted mb-2">${book.author}</p>
                                <div class="d-flex justify-content-between align-items-center mb-2">
                                    <span class="badge bg-secondary">${book.pages} pages</span>
                                    <span class="badge bg-info">${book.genre}</span>
                                </div>
                                <div class="d-flex justify-content-between align-items-center">
                                    <div class="rating">
                                        ${createStarRating(book.rating)}
                                    </div>
                                    <span class="last-read">Last read: ${date}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            }
        
            // Create star rating HTML
            function createStarRating(rating) {
                const fullStars = Math.floor(rating);
                const hasHalfStar = rating % 1 >= 0.5;
                let starsHTML = '';
        
                for (let i = 0; i < 5; i++) {
                    if (i < fullStars) {
                        starsHTML += '<i class="bi bi-star-fill text-warning"></i>';
                    } else if (i === fullStars && hasHalfStar) {
                        starsHTML += '<i class="bi bi-star-half text-warning"></i>';
                    } else {
                        starsHTML += '<i class="bi bi-star text-warning"></i>';
                    }
                }
        
                return starsHTML;
            }
        
            // Display books in the container
            async function displayBooks(books) {
                bookContainer.innerHTML = books.map(book => createBookCard(book)).join('');
                
                // Add click event listeners to all book cards
                document.querySelectorAll('.book-card').forEach(card => {
                    card.addEventListener('click', () => {
                        const bookId = card.dataset.bookId;
                        window.location.href = `index.html?bookId=${bookId}`;
                    });
                });
            }
        
            // Initial load of books
            async function loadBooks() {
                bookContainer.innerHTML = '';
                bookContainer.appendChild(loadingSpinner);
        
                try {
                    const books = await bookDatabase.getAllBooks();
                    displayBooks(books);
                } catch (error) {
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
                searchTimeout = setTimeout(async () => {
                    const query = e.target.value.trim();
                    if (query === '') {
                        loadBooks();
                    } else {
                        bookContainer.innerHTML = '';
                        bookContainer.appendChild(loadingSpinner);
                        const results = await bookDatabase.searchBooks(query);
                        displayBooks(results);
                    }
                }, 300);
            });
        
            // Load books when page loads
            loadBooks();
        });