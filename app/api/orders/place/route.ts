import { NextRequest, NextResponse } from 'next/server';
import { SignedOrder, OrderResponse } from '@/lib/types/order';

export async function POST(request: NextRequest) {
  try {
    const signedOrder: SignedOrder = await request.json();

    if (!signedOrder.order || !signedOrder.signature) {
      return NextResponse.json(
        { error: 'Invalid signed order' },
        { status: 400 }
      );
    }

    // Validate order parameters
    const { order } = signedOrder;
    if (!order.tokenId || !order.price || !order.size || !order.side) {
      return NextResponse.json(
        { error: 'Missing required order parameters' },
        { status: 400 }
      );
    }

    // In a real implementation, you would submit this to PolyMarket's relayer
    // For now, we'll return a success response
    // The actual submission should be done client-side using the CLOB client
    
    return NextResponse.json({
      success: true,
      message: 'Order signed successfully. Submit to relayer from client.',
      order: signedOrder,
    } as OrderResponse);
  } catch (error) {
    console.error('Error processing order:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Internal server error' 
      } as OrderResponse,
      { status: 500 }
    );
  }
}

