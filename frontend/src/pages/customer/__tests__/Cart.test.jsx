import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import Cart from '../Cart';

// Mock the cart context
const mockRemoveFromCart = vi.fn();
const mockClearCart = vi.fn();

vi.mock('../../../contexts/CartContext', () => ({
    useCart: () => ({
        cartItems: [
            { productId: 'prod1', name: 'Test Product 1', quantity: 2, lineTotal: 100, image: 'test.jpg' }
        ],
        subtotal: 100,
        shipping: 5,
        total: 105,
        loading: false,
        error: null,
        removeFromCart: mockRemoveFromCart,
        clearCart: mockClearCart
    }),
}));

// Mock the customer context to avoid CustomerNavbar error
vi.mock('../../../contexts/CustomerContext', () => ({
    useCustomer: () => ({
        customer: { id: 'cust123', name: 'John Doe' },
        loading: false,
    }),
    CustomerProvider: ({ children }) => <div>{children}</div>
}));

// Mock external assets hook
vi.mock('../../../hooks/useExternalAssets', () => ({
    useExternalAssets: vi.fn(),
}));

describe('Cart Component', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        
        // Mock fetch API for auth check
        global.fetch = vi.fn((url) => {
            if (url.includes('/auth/verify')) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({ authenticated: true, user: { userType: 'customer', displayName: 'John Doe', email: 'test@example.com' } })
                });
            }
            if (url.includes('/checkout/initiate')) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({ success: true, paymentIntentId: 'pi_123', amountPaise: 10500, currency: 'INR', razorpayOrderId: 'order_123', razorpayKeyId: 'rzp_test_123' })
                });
            }
            return Promise.reject(new Error('Not found'));
        });
    });

    const renderComponent = () => {
        return render(
            <MemoryRouter>
                <Cart />
            </MemoryRouter>
        );
    };

    it('renders cart items and summary correctly', () => {
        renderComponent();
        
        // Wait for items to be present
        expect(screen.getByText('Test Product 1')).toBeInTheDocument();
        expect(screen.getByText('Qty: 2')).toBeInTheDocument();
        
        // Summary should be present
        expect(screen.getAllByText('₹100.00').length).toBeGreaterThan(0); // Subtotal + item price
        expect(screen.getByText('₹5.00')).toBeInTheDocument();   // Shipping
        expect(screen.getByText('₹105.00')).toBeInTheDocument(); // Total
    });

    it('calls removeFromCart when remove button is clicked', async () => {
        mockRemoveFromCart.mockResolvedValueOnce({ success: true, message: 'Item removed' });
        
        renderComponent();
        
        const removeButton = screen.getByRole('button', { name: /remove/i });
        fireEvent.click(removeButton);

        await waitFor(() => {
            expect(mockRemoveFromCart).toHaveBeenCalledWith('prod1');
        });
    });

    it('shows validation error if checking out with empty required fields', async () => {
        renderComponent();
        
        const checkoutButton = screen.getByRole('button', { name: /checkout/i });
        fireEvent.click(checkoutButton);

        // Initially address/phone might be empty, so validation should trigger
        await waitFor(() => {
            expect(screen.getByText(/address is required/i)).toBeInTheDocument();
        });
    });
});
