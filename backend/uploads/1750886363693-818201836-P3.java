package TP1;

import java.io.ObjectOutputStream;
import java.net.DatagramPacket;
import java.net.DatagramSocket;
import java.net.InetAddress;
import java.net.Socket;

public class P3 {
	static int somme(int a,int b)
	{
		return(a+b);
	}
	
	static boolean premier(int s)
	{
		for(int i=2;i<=s/2;i++)
		{
			if(s%i==0) {return false;}
		}
		return true;
	}
	
	static int produit(int s)
	{
		int p=1;
		for(int i=1;i<=s;i++)
		{
			if(premier(i)) {p=p*i;}
		}
		return p;
	}

	public static void main(String[] args) {
		// TODO Auto-generated method stub
		try {
			DatagramSocket s = new DatagramSocket(2003);
			byte[] receiveData = new byte[10];
			DatagramPacket p = new DatagramPacket(receiveData, receiveData.length);
			s.receive(p);
			String N= new String(p.getData());
			N=N.trim();
			System.out.println("N="+N);
			s.receive(p);
			String M= new String(p.getData()).trim();
			System.out.println("M="+M);
			s.close();
			int som=somme(Integer.parseInt(N),Integer.parseInt(M));
			System.out.println("somme ="+som);
			int pr=produit(som);
			System.out.println("pr ="+pr);
			//envoyer ack a P1
			DatagramSocket s2 = new DatagramSocket();
			byte[] t = new byte[10];
			t="Ack".getBytes();
			DatagramPacket p1 = new DatagramPacket(t, t.length,InetAddress.getByName("localhost"),2001);
		    s2.send(p1);
		    s2.close();
		    //ENVOYER A p4
		    Socket c = new Socket("localhost",2004);
			ObjectOutputStream outP3 = new ObjectOutputStream(c.getOutputStream());
			outP3.writeObject(Integer.toString(som));outP3.writeObject(Integer.toString(pr));
			outP3.close();
		}
		catch(Exception e) {System.out.println(e.toString());}
	}

}
