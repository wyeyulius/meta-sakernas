<?php

namespace App\Http\Controllers;

use Illuminate\Support\Facades\DB;
use Illuminate\Http\Request;
use Inertia\Inertia;

class AdminController extends Controller
{
    //Index
    public function index()
    {
        $data = DB::table('monitoring')
                    ->select('kabupaten', 'nama_kabupaten', DB::raw('sum(jumlah_entri) as jml_entri'))
                    ->groupBy('kabupaten', 'nama_kabupaten')
                    ->get();


        // $monitoring = DB::table('regions')
        //                 ->joinSub($responses, 'responses',)
        //                 ->get();
        return Inertia::render('Admin/Index', [
            'data' => $data
        ]);
    }


}
