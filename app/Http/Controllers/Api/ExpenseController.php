<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Actions\Expenses\CreateExpenseMonth;
use App\Actions\Expenses\AddRecord;
use Illuminate\Http\Request;

class ExpenseController extends Controller
{
    public function index(Request $request)
    {
        $house = $request->user()->house;

        // Correct eager loading
        $expenses = $house->expenses()->with('records.category')->get();

        return response()->json($expenses);
    }

    public function addRecord(Request $request, AddRecord $action)
    {
        $record = $action->handle($request->validated(), $request->user());
        return response()->json($record);
    }
}