<?php

namespace App\Http\Controllers;

use Illuminate\Support\Facades\DB;
use Illuminate\Http\Request;
use Inertia\Inertia;
use App\Models\Region;
use League\Csv\Writer;

class AdminController extends Controller
{
    //Index
    public function index()
    {
        if (auth()->user()->kabupaten == '00') {
            $total = DB::table('monitoring')
                    ->select(DB::raw('"00" kabupaten, "SULAWESI UTARA" nama_kabupaten, sum(jumlah_entri) as jml_entri, sum(jml_sampel) as jml_sampel'));
        
            $data = DB::table('monitoring')
                    ->select('kabupaten', 'nama_kabupaten', DB::raw('sum(jumlah_entri) as jml_entri, sum(jml_sampel) as jml_sampel'))
                    ->groupBy('kabupaten', 'nama_kabupaten')
                    ->unionAll($total)
                    ->get();
        }
        else{
            $total = DB::table('monitoring')
            ->select(DB::raw('"00" kabupaten, "SULAWESI UTARA" nama_kabupaten, sum(jumlah_entri) as jml_entri, sum(jml_sampel) as jml_sampel'));

            $data = DB::table('monitoring')
                    ->select('kabupaten', 'nama_kabupaten', DB::raw('sum(jumlah_entri) as jml_entri, sum(jml_sampel) as jml_sampel'))
                    ->groupBy('kabupaten', 'nama_kabupaten')
                    ->where('kabupaten', '=', auth()->user()->kabupaten)
                    ->unionAll($total)
                    ->get();
        }
        


        // $monitoring = DB::table('regions')
        //                 ->joinSub($responses, 'responses',)
        //                 ->get();
        return Inertia::render('Admin/Index', [
            'data' => $data
        ]);
    }

    public function kab($kab)
    {
        if (auth()->user()->kabupaten == '00') {
            $kabupaten = Region::where('kabupaten', $kab)->first();
            if (!$kabupaten) {
                abort(404, 'Not found');
            }

            $total = DB::table('monitoring')
                        ->select(DB::raw('"000" kabupaten,'.'"'.$kabupaten->nama_kabupaten.'"'.' nama_kabupaten, sum(jumlah_entri) as jml_entri, sum(jml_sampel) as jml_sampel'))
                        ->where('kabupaten', '=', $kabupaten->kabupaten);
            
            $data = DB::table('monitoring')
                        ->select('kecamatan', 'nama_kecamatan', DB::raw('sum(jumlah_entri) as jml_entri, sum(jml_sampel) as jml_sampel'))
                        ->where('kabupaten', '=', $kabupaten->kabupaten)
                        ->groupBy('kecamatan', 'nama_kecamatan')
                        ->unionAll($total)
                        ->get();
        }
        else{
            $kabupaten = Region::where('kabupaten', $kab)->first();
            if (!$kabupaten) {
                abort(404, 'Not found');
            }
            if ($kabupaten->kabupaten != auth()->user()->kabupaten) {
                abort(403, 'Access denied');
            }

            $total = DB::table('monitoring')
                        ->select(DB::raw('"000" kabupaten,'.'"'.$kabupaten->nama_kabupaten.'"'.' nama_kabupaten, sum(jumlah_entri) as jml_entri, sum(jml_sampel) as jml_sampel'))
                        ->where('kabupaten', '=', $kabupaten->kabupaten);
            
            $data = DB::table('monitoring')
                        ->select('kecamatan', 'nama_kecamatan', DB::raw('sum(jumlah_entri) as jml_entri, sum(jml_sampel) as jml_sampel'))
                        ->where('kabupaten', '=', $kabupaten->kabupaten)
                        ->groupBy('kecamatan', 'nama_kecamatan')
                        ->unionAll($total)
                        ->get();
        }
        // $monitoring = DB::table('regions')
        //                 ->joinSub($responses, 'responses',)
        //                 ->get();
        return Inertia::render('Admin/Kab', [
            'data' => $data
        ]);
    }

    public function kec($kab, $kec)
    {
        if (auth()->user()->kabupaten == '00') {
            $kecamatan = Region::where('kabupaten', $kab)->where('kecamatan', $kec)->first();
            if (!$kecamatan) {
                abort(404, 'Not found');
            }

            $total = DB::table('monitoring')
                        ->select(DB::raw('"000" kecamatan,'.'"'.$kecamatan->nama_kecamatan.'"'.' nama_kecamatan, sum(jumlah_entri) as jml_entri, sum(jml_sampel) as jml_sampel'))
                        ->where('kabupaten', '=', $kecamatan->kabupaten)
                        ->where('kecamatan', '=', $kecamatan->kecamatan);
            
            $data = DB::table('monitoring')
                        ->select('desa', 'nama_desa', DB::raw('sum(jumlah_entri) as jml_entri, sum(jml_sampel) as jml_sampel'))
                        ->where('kabupaten', '=', $kecamatan->kabupaten)
                        ->where('kecamatan', '=', $kecamatan->kecamatan)
                        ->groupBy('desa', 'nama_desa')
                        ->unionAll($total)
                        ->get();
        }
        else{
            $kecamatan = Region::where('kabupaten', $kab)->where('kecamatan', $kec)->first();
            if (!$kecamatan) {
                abort(404, 'Not found');
            }
            if ($kecamatan->kabupaten != auth()->user()->kabupaten) {
                abort(403, 'Access denied');
            }

            $total = DB::table('monitoring')
                        ->select(DB::raw('"000" kecamatan,'.'"'.$kecamatan->nama_kecamatan.'"'.' nama_kecamatan, sum(jumlah_entri) as jml_entri, sum(jml_sampel) as jml_sampel'))
                        ->where('kabupaten', '=', $kecamatan->kabupaten)
                        ->where('kecamatan', '=', $kecamatan->kecamatan);
            
            $data = DB::table('monitoring')
                        ->select('desa', 'nama_desa', DB::raw('sum(jumlah_entri) as jml_entri, sum(jml_sampel) as jml_sampel'))
                        ->where('kabupaten', '=', $kecamatan->kabupaten)
                        ->where('kecamatan', '=', $kecamatan->kecamatan)
                        ->groupBy('desa', 'nama_desa')
                        ->unionAll($total)
                        ->get();
        }
        // $monitoring = DB::table('regions')
        //                 ->joinSub($responses, 'responses',)
        //                 ->get();
        return Inertia::render('Admin/Kec', [
            'data' => $data
        ]);
    }

    public function desa($kab, $kec, $desa)
    {   
        if (auth()->user()->kabupaten == '00') {
            $desakel = Region::where('kabupaten', $kab)->where('kecamatan', $kec)->where('desa', $desa)->first();
            if (!$desakel) {
                abort(404, 'Not found');
            }

            $total = DB::table('monitoring')
                        ->select(DB::raw('"000" desa,'.'"'.$desakel->nama_desa.'"'.' nama_desa, sum(jumlah_entri) as jml_entri, sum(jml_sampel) as jml_sampel'))
                        ->where('kabupaten', '=', $desakel->kabupaten)
                        ->where('kecamatan', '=', $desakel->kecamatan)
                        ->where('desa', '=', $desakel->desa);
            
            $data = DB::table('monitoring')
                        ->select('nbs', 'nks', DB::raw('sum(jumlah_entri) as jml_entri, sum(jml_sampel) as jml_sampel'))
                        ->where('kabupaten', '=', $desakel->kabupaten)
                        ->where('kecamatan', '=', $desakel->kecamatan)
                        ->where('desa', '=', $desakel->desa)
                        ->groupBy('nbs', 'nks')
                        ->unionAll($total)
                        ->get();
        }
        else{
            $desakel = Region::where('kabupaten', $kab)->where('kecamatan', $kec)->where('desa', $desa)->first();
            if (!$desakel) {
                abort(404, 'Not found');
            }
            if ($desakel->kabupaten != auth()->user()->kabupaten) {
                abort(403, 'Access denied');
            }

            $total = DB::table('monitoring')
                        ->select(DB::raw('"000" desa,'.'"'.$desakel->nama_desa.'"'.' nama_desa, sum(jumlah_entri) as jml_entri, sum(jml_sampel) as jml_sampel'))
                        ->where('kabupaten', '=', $desakel->kabupaten)
                        ->where('kecamatan', '=', $desakel->kecamatan)
                        ->where('desa', '=', $desakel->desa);
            
            $data = DB::table('monitoring')
                        ->select('nbs', 'nks', DB::raw('sum(jumlah_entri) as jml_entri, sum(jml_sampel) as jml_sampel'))
                        ->where('kabupaten', '=', $desakel->kabupaten)
                        ->where('kecamatan', '=', $desakel->kecamatan)
                        ->where('desa', '=', $desakel->desa)
                        ->groupBy('nbs', 'nks')
                        ->unionAll($total)
                        ->get();
        }
        // $monitoring = DB::table('regions')
        //                 ->joinSub($responses, 'responses',)
        //                 ->get();
        return Inertia::render('Admin/Desa', [
            'data' => $data
        ]);
    }
    public function export()
    {
        $user_kab = auth()->user()->kabupaten;
        if ($user_kab == "00") {
            $kabupaten = Region::all()->unique('kabupaten')->map(fn($kabupaten) =>[
                'id' => $kabupaten->kabupaten,
                'nama' => '['.$kabupaten->kabupaten.'] '.$kabupaten->nama_kabupaten
            ]);
        }
        else{
            $kabupaten = Region::all()->where('kabupaten', auth()->user()->kabupaten)->unique('kabupaten')->map(fn($kabupaten) =>[
                'id' => $kabupaten->kabupaten,
                'nama' => '['.$kabupaten->kabupaten.'] '.$kabupaten->nama_kabupaten
            ]);
        }
        return Inertia::render('Admin/Export', [
            'kabupatens' => $kabupaten,
            'user_kab' => $user_kab
        ]);
    }
    public function download(Request $request)
    {
        $data = null;
        if ($request->blok != null) {
            $data = DB::table('responses') // Fetch data from your database
                    ->join('regions', 'responses.region_id', '=', 'regions.id')
                    ->select('regions.provinsi', 'regions.nama_provinsi','regions.kabupaten','regions.nama_kabupaten','regions.kecamatan', 'regions.nama_kecamatan','regions.desa','regions.nama_desa', 'regions.nbs','regions.nks' , 'responses.pcl','responses.pml','responses.nurt','responses.no_art','responses.nama_art','responses.umur','responses.r6a','responses.r8a','responses.r8b','responses.r8c','responses.r8d','responses.r8e','responses.r8f','responses.r9a','responses.r9b','responses.r9c','responses.r10','responses.konfirmasir10 as konfirmasi_r10','responses.r12a','responses.r12b','responses.r12c','responses.r13a','responses.kbli','responses.kbji','responses.r16a','responses.r16b','responses.r25a','responses.r37a','responses.r37b','responses.konfirmasir37 as konfirmasi_r37','responses.r41a','responses.konfirmasi as konfirmasi_r41','responses.r44a','responses.r49d', DB::raw('cast(created_at as date) as tanggal_entri'))
                    ->where('regions.id', '=', $request->blok)
                    ->get();
        }
        elseif ($request->blok == null && $request->desa != null) {
            $data = DB::table('responses') // Fetch data from your database
                    ->join('regions', 'responses.region_id', '=', 'regions.id')
                    ->select('regions.provinsi', 'regions.nama_provinsi','regions.kabupaten','regions.nama_kabupaten','regions.kecamatan', 'regions.nama_kecamatan','regions.desa','regions.nama_desa', 'regions.nbs','regions.nks' , 'responses.pcl','responses.pml','responses.nurt','responses.no_art','responses.nama_art','responses.umur','responses.r6a','responses.r8a','responses.r8b','responses.r8c','responses.r8d','responses.r8e','responses.r8f','responses.r9a','responses.r9b','responses.r9c','responses.r10','responses.konfirmasir10 as konfirmasi_r10','responses.r12a','responses.r12b','responses.r12c','responses.r13a','responses.kbli','responses.kbji','responses.r16a','responses.r16b','responses.r25a','responses.r37a','responses.r37b','responses.konfirmasir37 as konfirmasi_r37','responses.r41a','responses.konfirmasi as konfirmasi_r41','responses.r44a','responses.r49d', DB::raw('cast(created_at as date) as tanggal_entri'))
                    ->where('regions.desa', '=', $request->desa)
                    ->where('regions.kecamatan', '=', $request->kecamatan)
                    ->where('regions.kabupaten', '=', $request->kabupaten)
                    ->get();
        }
        elseif ($request->blok == null && $request->desa == null && $request->kecamatan != null) {
            $data = DB::table('responses') // Fetch data from your database
                    ->join('regions', 'responses.region_id', '=', 'regions.id')
                    ->select('regions.provinsi', 'regions.nama_provinsi','regions.kabupaten','regions.nama_kabupaten','regions.kecamatan', 'regions.nama_kecamatan','regions.desa','regions.nama_desa', 'regions.nbs','regions.nks' , 'responses.pcl','responses.pml','responses.nurt','responses.no_art','responses.nama_art','responses.umur','responses.r6a','responses.r8a','responses.r8b','responses.r8c','responses.r8d','responses.r8e','responses.r8f','responses.r9a','responses.r9b','responses.r9c','responses.r10','responses.konfirmasir10 as konfirmasi_r10','responses.r12a','responses.r12b','responses.r12c','responses.r13a','responses.kbli','responses.kbji','responses.r16a','responses.r16b','responses.r25a','responses.r37a','responses.r37b','responses.konfirmasir37 as konfirmasi_r37','responses.r41a','responses.konfirmasi as konfirmasi_r41','responses.r44a','responses.r49d', DB::raw('cast(created_at as date) as tanggal_entri'))
                    ->where('regions.kecamatan', '=', $request->kecamatan)
                    ->where('regions.kabupaten', '=', $request->kabupaten)
                    ->get();
        }
        elseif ($request->blok == null && $request->desa == null && $request->kecamatan == null && $request->kabupaten != null) {
            $data = DB::table('responses') // Fetch data from your database
                    ->join('regions', 'responses.region_id', '=', 'regions.id')
                    ->select('regions.provinsi', 'regions.nama_provinsi','regions.kabupaten','regions.nama_kabupaten','regions.kecamatan', 'regions.nama_kecamatan','regions.desa','regions.nama_desa', 'regions.nbs','regions.nks' , 'responses.pcl','responses.pml','responses.nurt','responses.no_art','responses.nama_art','responses.umur','responses.r6a','responses.r8a','responses.r8b','responses.r8c','responses.r8d','responses.r8e','responses.r8f','responses.r9a','responses.r9b','responses.r9c','responses.r10','responses.konfirmasir10 as konfirmasi_r10','responses.r12a','responses.r12b','responses.r12c','responses.r13a','responses.kbli','responses.kbji','responses.r16a','responses.r16b','responses.r25a','responses.r37a','responses.r37b','responses.konfirmasir37 as konfirmasi_r37','responses.r41a','responses.konfirmasi as konfirmasi_r41','responses.r44a','responses.r49d', DB::raw('cast(created_at as date) as tanggal_entri'))
                    ->where('regions.kabupaten', '=', $request->kabupaten)
                    ->get();
        }
        else{
            $data = DB::table('responses') // Fetch data from your database
            ->join('regions', 'responses.region_id', '=', 'regions.id')
            ->select('regions.provinsi', 'regions.nama_provinsi','regions.kabupaten','regions.nama_kabupaten','regions.kecamatan', 'regions.nama_kecamatan','regions.desa','regions.nama_desa', 'regions.nbs','regions.nks' , 'responses.pcl','responses.pml','responses.nurt','responses.no_art','responses.nama_art','responses.umur','responses.r6a','responses.r8a','responses.r8b','responses.r8c','responses.r8d','responses.r8e','responses.r8f','responses.r9a','responses.r9b','responses.r9c','responses.r10','responses.konfirmasir10 as konfirmasi_r10','responses.r12a','responses.r12b','responses.r12c','responses.r13a','responses.kbli','responses.kbji','responses.r16a','responses.r16b','responses.r25a','responses.r37a','responses.r37b','responses.konfirmasir37 as konfirmasi_r37','responses.r41a','responses.konfirmasi as konfirmasi_r41','responses.r44a','responses.r49d', DB::raw('cast(created_at as date) as tanggal_entri'))
            ->get();
        }

        if($data->isEmpty()){
            return response()->json(['message' => 'No data to export.'], 204);
        }
        
        $csv = Writer::createFromString('');
        $csv->insertOne(array_keys((array) $data[0])); // Add column headers


        foreach ($data as $row) {
            $csv->insertOne((array) $row); // Insert data rows
        } 
    

        $filename = 'export.csv';

        return response($csv, 200, [
            'Content-Type' => 'text/csv',
            'Content-Disposition' => 'attachment; filename="' . $filename . '"',
        ]);
    }

}
