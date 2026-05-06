import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { vi } from 'vitest';
import CampaignShopping from '../CampaignShopping';

// Mock the cart context
const mockAddToCart = vi.fn();
vi.mock('../../../contexts/CartContext', () => ({
    useCart: () => ({
        addToCart: mockAddToCart,
    }),
}));

// Mock the customer context
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

const mockCampaignData = {
    campaign: {
        _id: 'camp123',
        title: 'Summer Sale',
        brand_id: { brandName: 'Test Brand' },
    },
    products: [
        {
            _id: 'prod1',
            name: 'Test Product 1',
            description: 'A great product',
            campaign_price: 50,
            target_quantity: 100,
            sold_quantity: 0,
            images: [{ url: 'test.jpg', is_primary: true }]
        }
    ],
    content: []
};

describe('CampaignShopping Component', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        
        // Mock fetch API
        global.fetch = vi.fn((url) => {
            if (url.includes('/auth/verify')) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({ authenticated: true, user: { userType: 'customer', displayName: 'John Doe' } })
                });
            }
            if (url.includes('/shop')) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve(mockCampaignData)
                });
            }
            return Promise.reject(new Error('Not found'));
        });
        
        // Mock window.prompt
        window.prompt = vi.fn().mockReturnValue('1');
    });

    const renderComponent = () => {
        return render(
            <MemoryRouter initialEntries={['/campaign/camp123/shop']}>
                <Routes>
                    <Route path="/campaign/:campaignId/shop" element={<CampaignShopping />} />
                </Routes>
            </MemoryRouter>
        );
    };

    it('renders loading state initially', () => {
        renderComponent();
        expect(screen.getAllByRole('status').length).toBeGreaterThan(0);
    });

    it('fetches and displays campaign data', async () => {
        renderComponent();
        
        await waitFor(() => {
            expect(screen.getByText('Summer Sale')).toBeInTheDocument();
        });
        
        // Wait for product to render
        await waitFor(() => {
            expect(screen.getByText('Test Product 1')).toBeInTheDocument();
            expect(screen.getByText('$50.00')).toBeInTheDocument(); // Formatted currency
        });
    });

    it('adds product to cart when add button is clicked', async () => {
        mockAddToCart.mockResolvedValueOnce({ success: true, message: 'Added to cart' });
        
        renderComponent();
        
        // Wait for product to render
        await waitFor(() => {
            expect(screen.getByText('Test Product 1')).toBeInTheDocument();
        });

        // Find and click the Add to Cart button
        const addToCartButton = screen.getByRole('button', { name: /add to cart/i });
        fireEvent.click(addToCartButton);

        await waitFor(() => {
            expect(window.prompt).toHaveBeenCalled();
            expect(mockAddToCart).toHaveBeenCalledWith('prod1', 1);
        });
    });
});
