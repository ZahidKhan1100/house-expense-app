<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\User;
use App\Models\House;
use App\Models\Record;
use Illuminate\Support\Facades\Auth;

class PaymentController extends Controller
{
    public function index(Request $request, $month = null)
    {
        $user = Auth::user();
        $house = $user->house;

        if (!$house) {
            return response()->json([
                'mates' => [],
                'transactions' => [],
                'currency' => '$',
                'available_months' => [],
                'month' => $month ?? now()->format('Y-m'),
                'paid_amounts' => [],
            ]);
        }

        $currency = $house->currency ?? '$';
        $month = $month ?? now()->format('Y-m');

        // --- Fetch all mates (approved + admin) ---
        $mates = $house->mates()
            ->whereIn('status', ['approved', 'admin'])
            ->get(['id', 'name']);

        // Include house admin if not already in mates
        if ($house->admin && !$mates->contains('id', $house->admin->id)) {
            $mates->push($house->admin->only(['id', 'name']));
        }

        $mateIds = $mates->pluck('id')->toArray();

        // --- Available months from records ---
        $availableMonths = $house->records()
            ->select('month')
            ->distinct()
            ->orderBy('month', 'desc')
            ->pluck('month')
            ->toArray();

        // --- Records for selected month ---
        $records = $house->records()
            ->where('month', $month)
            ->get();

        // --- Paid amounts per mate ---
        $paidAmounts = [];
        foreach ($mates as $mate) {
            $paidAmounts[$mate->id] = $records
                ->where('paid_by', $mate->id)
                ->sum('amount');
        }

        // --- Calculate balances ---
        $balance = [];
        foreach ($mates as $mate) $balance[$mate->id] = 0;

        foreach ($records as $rec) {
            $included = is_array($rec->included_mates) ? $rec->included_mates : [];

            // Ensure paid_by is included in split
            if (!in_array($rec->paid_by, $included)) {
                $included[] = $rec->paid_by;
            }

            // Only consider mates in the house
            $included = array_filter($included, fn($id) => in_array($id, $mateIds));
            if (count($included) === 0) continue;

            $split = $rec->amount / count($included);
            foreach ($included as $id) {
                if ($id == $rec->paid_by) {
                    $balance[$id] += $rec->amount - $split;
                } else {
                    $balance[$id] -= $split;
                }
            }
        }

        // --- Build transactions ---
        $creditors = [];
        $debtors = [];
        foreach ($balance as $id => $amt) {
            if ($amt > 0) $creditors[] = ['id' => $id, 'amount' => $amt];
            if ($amt < 0) $debtors[] = ['id' => $id, 'amount' => -$amt];
        }

        $transactions = [];
        $i = $j = 0;
        while ($i < count($debtors) && $j < count($creditors)) {
            $debtor = &$debtors[$i];
            $creditor = &$creditors[$j];
            $amt = min($debtor['amount'], $creditor['amount']);

            $transactions[] = [
                'from' => $debtor['id'],
                'to' => $creditor['id'],
                'amount' => round($amt, 2),
            ];

            $debtor['amount'] -= $amt;
            $creditor['amount'] -= $amt;

            if ($debtor['amount'] == 0) $i++;
            if ($creditor['amount'] == 0) $j++;
        }

        return response()->json([
            'mates' => $mates,
            'transactions' => $transactions,
            'currency' => $currency,
            'available_months' => $availableMonths,
            'month' => $month,
            'paid_amounts' => $paidAmounts,
        ]);
    }
}