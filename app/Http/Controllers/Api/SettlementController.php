<?php

namespace App\Http\Api\Controllers;
use App\Http\Controllers\Controller;
use App\Http\Requests\StoreSettlementRequest;
use App\Actions\Settlement\CreateSettlementAction;

class SettlementController extends Controller
{
    public function store(StoreSettlementRequest $request, CreateSettlementAction $action)
    {
        try {
            $settlement = $action->execute($request->validated());

            return response()->json([
                'success' => true,
                'settlement' => $settlement
            ], 201);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage()
            ], 400);
        }
    }
}