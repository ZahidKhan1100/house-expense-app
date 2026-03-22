<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;

use App\Models\Record;
use Illuminate\Http\Request;
use App\Models\Expense;
use App\Models\User;
use App\Models\Category;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class InsightsController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();
        $houseId = $user->house_id;

        // ----- Line Chart: Monthly Totals -----
        $monthlyTotals = DB::table('records')
            ->join('expenses', 'records.expense_id', '=', 'expenses.id')
            ->where('expenses.house_id', $houseId)
            ->whereYear('records.timestamp', now()->year)
            ->selectRaw('MONTH(records.timestamp) as month, SUM(records.amount) as total')
            ->groupBy(DB::raw('MONTH(records.timestamp)'))
            ->orderBy('month', 'asc')
            ->get()
            ->map(function ($item) {
                $months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
                return [
                    'month' => $months[$item->month - 1],
                    'total' => (float) $item->total
                ];
            });

        // ----- Pie Chart: Category Totals -----
        $categoryTotals = DB::table('records')
            ->join('expenses', 'records.expense_id', '=', 'expenses.id')
            ->join('categories', 'records.category_id', '=', 'categories.id')
            ->where('expenses.house_id', $houseId)
            ->selectRaw('categories.name, SUM(records.amount) as total')
            ->groupBy('categories.name')
            ->get()
            ->map(function ($item) {
                return [
                    'name' => $item->name,
                    'total' => (float) $item->total
                ];
            });

        // ----- Bar Chart: Individual Contributions -----
        $individualTotals = DB::table('records')
            ->join('expenses', 'records.expense_id', '=', 'expenses.id')
            ->join('users', 'records.added_by', '=', 'users.id')
            ->where('expenses.house_id', $houseId)
            ->selectRaw('users.name, SUM(records.amount) as total')
            ->groupBy('users.name')
            ->get()
            ->map(function ($item) {
                return [
                    'name' => $item->name,
                    'total' => (float) $item->total
                ];
            });

        return response()->json([
            'monthlyTotals' => $monthlyTotals,
            'categoryTotals' => $categoryTotals,
            'individualTotals' => $individualTotals,
        ]);
    }

    public function getExpensesByMonth(Request $request)
    {
        $user = auth()->user();
        $month = $request->query('month'); // e.g. Mar

        // Convert "Mar" → 03
        $monthNumber = date('m', strtotime($month));

        $records = Record::with('paidBy')
            ->whereHas('expense', function ($q) use ($user) {
                $q->where('house_id', $user->house_id);
            })
            ->whereMonth('timestamp', $monthNumber)
            ->get()
            ->map(function ($r) {
                return [
                    'id' => $r->id,
                    'amount' => $r->amount,
                    'description' => $r->description,
                    'paid_by_name' => optional($r->paidBy)->name,
                ];
            });

        return response()->json([
            'records' => $records
        ]);
    }
}