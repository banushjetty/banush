const request = require('supertest');
const app = require('../../testApp');
const { getAuthenticatedAgent } = require('../setup/authContext');
const { 
    createTestBrand, 
    createTestCampaign, 
    createTestProduct,
    createTestOrder
} = require('../setup/testHelpers');

describe('Customer Routes Integration', () => {
    let customerAgent;
    let customerUser;
    let testBrand;
    let testCampaign;
    let testProduct;

    beforeAll(async () => {
        // Create authenticated customer session
        const auth = await getAuthenticatedAgent('customer');
        customerAgent = auth.agent;
        customerUser = auth.user;

        // Setup test data
        testBrand = await createTestBrand();
        testCampaign = await createTestCampaign(testBrand._id);
        testProduct = await createTestProduct(testBrand._id, testCampaign._id);
    });

    describe('Public Browsing API', () => {
        it('should fetch all active shoppable campaigns', async () => {
            const res = await request(app).get('/customer/');
            expect(res.status).toBe(200);
            expect(Array.isArray(res.body.campaigns)).toBe(true);
        });

        it('should fetch campaign shopping page', async () => {
            const res = await request(app).get(`/customer/campaign/${testCampaign._id}/shop`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
        });

        it('should fetch product details', async () => {
            const res = await request(app).get(`/customer/product/${testProduct._id}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.product).toBeDefined();
        });
    });

    describe('Cart Management (Session-based)', () => {
        const publicAgent = request.agent(app);

        it('should get empty cart initially', async () => {
            const res = await publicAgent.get('/customer/cart');
            expect(res.status).toBe(200);
            expect(res.body.items).toBeDefined();
        });

        it('should add item to cart', async () => {
            const res = await publicAgent.post('/customer/cart/add').send({
                productId: testProduct._id,
                quantity: 2
            });
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.cartCount).toBe(2);
        });

        it('should remove item from cart', async () => {
            const res = await publicAgent.post('/customer/cart/remove').send({
                productId: testProduct._id
            });
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
        });
    });

    describe('Profile Management (Requires Auth)', () => {
        it('should get customer profile', async () => {
            const res = await customerAgent.get('/customer/profile');
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.customer).toBeDefined();
        });

        it('should update customer profile', async () => {
            const res = await customerAgent.put('/customer/profile').send({
                name: 'Updated Name',
                phone: '1234567890'
            });
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.customer.name).toBe('Updated Name');
        });
    });

    describe('Checkout Flow', () => {
        it('should fetch order history', async () => {
            // First create a test order for this customer
            await createTestOrder(customerUser._id, testProduct._id);

            const res = await customerAgent.get('/customer/orders');
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(Array.isArray(res.body.orders)).toBe(true);
            expect(res.body.orders.length).toBeGreaterThan(0);
        });

        it('should initiate checkout successfully', async () => {
            // Put something in the customer's cart
            await customerAgent.post('/customer/cart/add').send({
                productId: testProduct._id,
                quantity: 1
            });

            const res = await customerAgent.post('/customer/checkout/initiate').send({
                customerInfo: {
                    name: 'Test Customer',
                    email: customerUser.email,
                    address_line1: '123 Main St',
                    city: 'Testville',
                    state: 'TS',
                    zip_code: '12345',
                    country: 'US'
                }
            });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.razorpayOrderId).toBeDefined();
        });
    });
});
